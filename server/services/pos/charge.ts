import { createError } from "h3";
import type { H3Event } from "h3";

import { applyInventoryStockMutation } from "../../utils/inventory";
import {
  assertBranchAccess,
  assertEmployeeCanDeliverService,
  buildAppointmentInsert,
  buildReceiptFromTransaction,
  buildServiceWindow,
  buildTransactionInsert,
  getInventoryForBranch,
  getPOSBranchOrThrow,
  getPOSEmployeeOrThrow,
  getPOSServiceOrThrow,
  getProductOrThrow,
  mapPOSError,
  requirePOSContextStrict,
  validateServiceAvailability,
  withTitleAndSubtitle,
} from "../../utils/pos";
import { chargeSalesOrderSchema, type ChargeSalesOrderInput } from "../../utils/pos-sales";
import { getReceiptFormatFromOrganization } from "../receipts/verification";

export async function chargeSalesOrder(event: H3Event, payload: ChargeSalesOrderInput) {
  const context = await requirePOSContextStrict(event, "can_create");
  if (context.role === "employee") {
    throw createError({ statusCode: 403, statusMessage: "Tu rol no puede cobrar ventas." });
  }
  const input = chargeSalesOrderSchema.parse(payload);

  const { data: order, error: orderError } = await (context.adminClient as any)
    .from("sales_orders")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", input.salesOrderId)
    .maybeSingle();

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: "Orden de venta no encontrada." });
  }
  if (order.status !== "ready_to_charge") {
    throw createError({ statusCode: 409, statusMessage: "La orden debe estar lista para cobro." });
  }

  const { data: items, error: itemsError } = await (context.adminClient as any)
    .from("sales_order_items")
    .select("*")
    .eq("sales_order_id", order.id);
  if (itemsError || !items || items.length === 0) {
    throw createError({ statusCode: 409, statusMessage: "La orden no tiene items válidos para cobro." });
  }

  const branch = await getPOSBranchOrThrow(context, order.branch_id);
  assertBranchAccess(context, branch.id);

  const { data: organizationSettings } = await (context.adminClient as any)
    .from("organizations")
    .select("default_receipt_format")
    .eq("id", context.organizationId)
    .maybeSingle();
  const formatUsed = input.receiptFormatOverride ?? getReceiptFormatFromOrganization(organizationSettings ?? null);

  const typedItems = (items ?? []) as Array<Record<string, any>>;
  const productRows = typedItems.filter((item: Record<string, any>) => item.item_type === "product" && item.product_id);
  const inventoryMap = await getInventoryForBranch(context, branch.id, productRows.map((item: Record<string, any>) => item.product_id as string));
  const createdAppointments: string[] = [];
  const appliedStockAdjustments: Array<{ productId: string; quantity: number }> = [];

  try {
    for (const item of productRows) {
      const productId = item.product_id as string;
      const product = await getProductOrThrow(context, productId);
      const stock = inventoryMap.get(productId);
      const quantity = Number(item.quantity);
      if ((product.track_inventory ?? true) && stock) {
        const available = Math.max(0, (stock.quantity ?? 0) - (stock.reserved_quantity ?? 0));
        if (available < quantity) {
          throw createError({ statusCode: 409, statusMessage: `Stock insuficiente para ${product.name}. Disponible: ${available}.` });
        }
      }
      await applyInventoryStockMutation(context, {
        branchId: branch.id,
        productId,
        mode: "remove",
        quantity,
        requireAvailable: true,
      });
      appliedStockAdjustments.push({ productId, quantity });
    }

    for (const item of typedItems.filter((row: Record<string, any>) => row.item_type === "service" && row.service_id && row.employee_id)) {
      const service = await getPOSServiceOrThrow(context, item.service_id as string);
      const employee = await getPOSEmployeeOrThrow(context, item.employee_id as string);
      await assertEmployeeCanDeliverService(context, employee, service, order.branch_id);

      const { startIso, endIso } = buildServiceWindow(String(item.scheduled_date), String(item.scheduled_time), service.duration_minutes);
      await validateServiceAvailability(context, employee.id, startIso, endIso);

      const { data: appointment, error: appointmentError } = await (context.adminClient as any)
        .from("appointments")
        .insert(buildAppointmentInsert(
          context,
          order.branch_id,
          order.customer_id,
          order.customer_full_name,
          order.customer_phone,
          employee.id,
          service.id,
          startIso,
          endIso,
          order.note ?? undefined,
        ))
        .select("id")
        .single();

      if (appointmentError || !appointment) {
        throw appointmentError ?? new Error("No se pudo crear la cita.");
      }
      createdAppointments.push(appointment.id);
    }

    const transactionInsert = buildTransactionInsert(
      context,
      order.branch_id,
      order.customer_id,
      Number(order.subtotal),
      Number(order.discount_amount),
      Number(order.final_amount),
      input.paymentMethod,
    );

    const { data: transaction, error: transactionError } = await (context.adminClient as any)
      .from("transactions")
      .insert(transactionInsert)
      .select("id")
        .single();
    if (transactionError || !transaction) {
      throw transactionError ?? new Error("No se pudo crear la transacción.");
    }

    const transactionItems = typedItems.map((item: Record<string, any>) => ({
      transaction_id: transaction.id,
      item_type: item.item_type,
      product_id: item.product_id,
      service_id: item.service_id,
      appointment_id: null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      snapshot_data: withTitleAndSubtitle(item.item_type, {
        title: (item.snapshot_data as Record<string, unknown> | null)?.title as string ?? (item.item_type === "product" ? "Producto" : "Servicio"),
        subtitle: ((item.snapshot_data as Record<string, unknown> | null)?.subtitle as string) ?? null,
        customer: {
          mode: order.customer_mode,
          customerId: order.customer_id,
          fullName: order.customer_full_name,
          phone: order.customer_phone,
          email: order.customer_email,
        },
        extra: { receiptFormatUsed: formatUsed },
      }),
    }));

    const { error: txItemsError } = await (context.adminClient as any).from("transaction_items").insert(transactionItems);
    if (txItemsError) {
      throw txItemsError;
    }

    if (createdAppointments.length > 0) {
      await (context.adminClient as any)
        .from("appointments")
        .update({ transaction_id: transaction.id, status: "completed" })
        .in("id", createdAppointments);
    }

    await (context.adminClient as any)
      .from("sales_orders")
      .update({
        status: "charged",
        charged_transaction_id: transaction.id,
        charged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    const receipt = await buildReceiptFromTransaction(context, transaction.id);
    return { success: true, transactionId: transaction.id, receipt };
  } catch (error) {
    for (const adjustment of appliedStockAdjustments.reverse()) {
      await applyInventoryStockMutation(context, {
        branchId: order.branch_id,
        productId: adjustment.productId,
        mode: "add",
        quantity: adjustment.quantity,
      });
    }
    if (createdAppointments.length > 0) {
      await (context.adminClient as any).from("appointments").delete().in("id", createdAppointments);
    }
    return mapPOSError(error, "No se pudo cobrar la orden de venta.");
  }
}
