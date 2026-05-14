import type { z } from "zod";

import { applyInventoryStockMutation } from "../../utils/inventory";

import type { Database } from "@/types/database.types";

import {
  assertBranchAccess,
  assertEmployeeCanDeliverService,
  buildAppointmentInsert,
  buildReceiptFromTransaction,
  buildServiceWindow,
  buildTransactionInsert,
  checkoutSchema,
  computeDiscountAmount,
  createPOSWalkInCustomer,
  getCategoriesMap,
  getCustomerOrThrow,
  getInventoryForBranch,
  getPOSBranchOrThrow,
  getPOSEmployeeOrThrow,
  getPOSServiceOrThrow,
  getProductOrThrow,
  mapPOSError,
  validateServiceAvailability,
  withTitleAndSubtitle,
} from "../../utils/pos";

import type { POSContext } from "../../utils/pos";

type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
type TransactionItemInsert = Database["public"]["Tables"]["transaction_items"]["Insert"];
type CheckoutBody = z.infer<typeof checkoutSchema>;

interface CreatedAppointment {
  id: string;
  serviceId: string;
  employeeId: string;
}

export interface POSCheckoutResult {
  success: boolean;
  transactionId: string;
  receipt: Awaited<ReturnType<typeof buildReceiptFromTransaction>>;
  createdAppointments: CreatedAppointment[];
}

export async function processPOSCheckout(
  context: POSContext,
  body: CheckoutBody,
): Promise<POSCheckoutResult> {
  const branch = await getPOSBranchOrThrow(context, body.branchId);
  assertBranchAccess(context, branch.id);

  const categoriesMap = await getCategoriesMap(context);
  const productItems = body.items.filter((item) => item.itemType === "product");
  const serviceItems = body.items.filter((item) => item.itemType === "service");

  const inventoryMap = await getInventoryForBranch(context, branch.id, productItems.map((item) => item.productId));
  const serviceWindowsByEmployee = new Map<string, Array<{ startIso: string; endIso: string }>>();

  let customerId: string | null = null;
  let customerSnapshot: {
    mode: "existing" | "walk_in";
    customerId: string | null;
    fullName: string;
    phone: string | null;
    email?: string | null;
  };

  if (body.customer.mode === "existing") {
    const customer = await getCustomerOrThrow(context, body.customer.customerId);
    customerId = customer.id;
    customerSnapshot = {
      mode: "existing",
      customerId: customer.id,
      fullName: [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Cliente",
      phone: customer.phone,
      email: customer.email,
    };
  } else {
    const guestCustomer = await createPOSWalkInCustomer(context, body.customer);
    customerId = guestCustomer.id;
    customerSnapshot = {
      mode: "walk_in",
      customerId: guestCustomer.id,
      fullName: [guestCustomer.first_name, guestCustomer.last_name].filter(Boolean).join(" ").trim() || body.customer.fullName.trim(),
      phone: guestCustomer.phone,
      email: null,
    };
  }

  try {
    const itemInserts: TransactionItemInsert[] = [];
    const stockAdjustments: Array<{ productId: string; quantity: number }> = [];
    const createdAppointments: CreatedAppointment[] = [];
    let subtotal = 0;

    for (const item of productItems) {
      const product = await getProductOrThrow(context, item.productId);
      const stock = inventoryMap.get(product.id) ?? null;

      if (product.track_inventory) {
        if (!stock) {
          throw createError({
            statusCode: 409,
            statusMessage: `No existe stock cargado para ${product.name} en esta sucursal.`,
          });
        }

        const available = Math.max(0, (stock.quantity ?? 0) - (stock.reserved_quantity ?? 0));
        if (available < item.quantity) {
          throw createError({
            statusCode: 409,
            statusMessage: `Stock insuficiente para ${product.name}. Disponible: ${available}.`,
          });
        }

        stockAdjustments.push({
          productId: product.id,
          quantity: item.quantity,
        });
      }

      const category = product.category_id ? categoriesMap.get(product.category_id) ?? null : null;
      const lineSubtotal = Number(product.sale_price) * item.quantity;
      subtotal += lineSubtotal;

      itemInserts.push({
        transaction_id: "",
        item_type: "product",
        product_id: product.id,
        service_id: null,
        appointment_id: null,
        quantity: item.quantity,
        unit_price: Number(product.sale_price),
        subtotal: lineSubtotal,
        snapshot_data: withTitleAndSubtitle("product", {
          title: product.name,
          subtitle: product.sku ? `SKU ${product.sku}` : category?.name ?? null,
          customer: customerSnapshot,
          extra: {
            sku: product.sku,
            categoryId: product.category_id,
            categoryName: category?.name ?? null,
            branchId: branch.id,
            branchName: branch.name,
            unitPriceAtSale: Number(product.sale_price),
            trackInventory: product.track_inventory ?? true,
          },
        }),
      });
    }

    for (const item of serviceItems) {
      const service = await getPOSServiceOrThrow(context, item.serviceId);
      const employee = await getPOSEmployeeOrThrow(context, item.employeeId);

      await assertEmployeeCanDeliverService(context, employee, service, branch.id);

      const { startIso, endIso } = buildServiceWindow(item.scheduledDate, item.scheduledTime, service.duration_minutes);
      await validateServiceAvailability(context, employee.id, startIso, endIso, body.appointmentId);

      const employeeWindows = serviceWindowsByEmployee.get(employee.id) ?? [];
      const overlapsCart = employeeWindows.some((window) => window.startIso < endIso && window.endIso > startIso);
      if (overlapsCart) {
        throw createError({
          statusCode: 409,
          statusMessage: `El colaborador ${employee.full_name} ya tiene otro servicio en el carrito para ese mismo horario.`,
        });
      }

      employeeWindows.push({ startIso, endIso });
      serviceWindowsByEmployee.set(employee.id, employeeWindows);

      const category = service.category_id ? categoriesMap.get(service.category_id) ?? null : null;
      const lineSubtotal = Number(service.price);
      subtotal += lineSubtotal;

      let appointmentId: string | null = null;

      if (body.createAppointments) {
        const appointmentInsert = buildAppointmentInsert(
          context,
          branch.id,
          customerId,
          customerSnapshot.fullName,
          customerSnapshot.phone,
          employee.id,
          service.id,
          startIso,
          endIso,
          body.note || undefined,
        );

        const { data: appointment, error: appointmentError } = await context.adminClient
          .from("appointments")
          .insert(appointmentInsert)
          .select("id")
          .single<{ id: string }>();

        if (appointmentError || !appointment) {
          throw appointmentError ?? new Error("No se pudo crear la cita para el servicio.");
        }

        appointmentId = appointment.id;
        createdAppointments.push({
          id: appointment.id,
          serviceId: service.id,
          employeeId: employee.id,
        });
      }

      itemInserts.push({
        transaction_id: "",
        item_type: "service",
        product_id: null,
        service_id: service.id,
        appointment_id: appointmentId,
        quantity: 1,
        unit_price: Number(service.price),
        subtotal: lineSubtotal,
        snapshot_data: withTitleAndSubtitle("service", {
          title: service.name,
          subtitle: `${employee.full_name} · ${item.scheduledDate} ${item.scheduledTime}`,
          customer: customerSnapshot,
          extra: {
            employeeId: employee.id,
            employeeName: employee.full_name,
            scheduledAt: startIso,
            durationMinutes: service.duration_minutes,
            categoryId: service.category_id,
            categoryName: category?.name ?? null,
            branchId: branch.id,
            branchName: branch.name,
            unitPriceAtSale: Number(service.price),
            appointmentId,
          },
        }),
      });
    }

    const discountAmount = computeDiscountAmount(subtotal, body.discount);
    const finalAmount = Math.max(0, subtotal - discountAmount);
    const appliedStockAdjustments: Array<{ productId: string; quantity: number }> = [];

    try {
      for (const stockAdjustment of stockAdjustments) {
        await applyInventoryStockMutation(context, {
          branchId: branch.id,
          productId: stockAdjustment.productId,
          mode: "remove",
          quantity: stockAdjustment.quantity,
          requireAvailable: true,
        });

        appliedStockAdjustments.push(stockAdjustment);
      }

      const transactionInsert: TransactionInsert = buildTransactionInsert(
        context,
        branch.id,
        customerId,
        subtotal,
        discountAmount,
        finalAmount,
        body.paymentMethod,
      );

      const { data: transaction, error: transactionError } = await context.adminClient
        .from("transactions")
        .insert(transactionInsert)
        .select("id")
        .single<{ id: string }>();

      if (transactionError || !transaction) {
        throw transactionError ?? new Error("No se pudo crear la transaccion del POS.");
      }

      const transactionItems = itemInserts.map((item) => ({
        ...item,
        transaction_id: transaction.id,
      }));

      const { error: itemsError } = await context.adminClient
        .from("transaction_items")
        .insert(transactionItems);

      if (itemsError) {
        throw itemsError;
      }

      if (body.appointmentId) {
        await context.adminClient
          .from("appointments")
          .update({
            transaction_id: transaction.id,
            status: "completed",
          })
          .eq("id", body.appointmentId);
      }

      for (const apt of createdAppointments) {
        await context.adminClient
          .from("appointments")
          .update({ transaction_id: transaction.id })
          .eq("id", apt.id);
      }

      const receipt = await buildReceiptFromTransaction(context, transaction.id);

      return {
        success: true,
        transactionId: transaction.id,
        receipt,
        createdAppointments,
      };
    } catch (error) {
      for (const stockAdjustment of appliedStockAdjustments.reverse()) {
        await applyInventoryStockMutation(context, {
          branchId: branch.id,
          productId: stockAdjustment.productId,
          mode: "add",
          quantity: stockAdjustment.quantity,
        });
      }

      for (const apt of createdAppointments) {
        await context.adminClient
          .from("appointments")
          .delete()
          .eq("id", apt.id);
      }

      throw error;
    }
  } catch (error) {
    return mapPOSError(error, "No se pudo completar el checkout del POS.");
  }
}
