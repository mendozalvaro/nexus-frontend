import { createError } from "h3";

import type { H3Event } from "h3";
import type { Json } from "@/types/database.types";
import {
  assertBranchAccess,
  getCategoriesMap,
  getCustomerOrThrow,
  getPOSAnonymousTemplateCustomerOrThrow,
  getPOSBranchOrThrow,
  getPOSEmployeeOrThrow,
  getPOSServiceOrThrow,
  getProductOrThrow,
  requirePOSContextStrict,
} from "../../utils/pos";
import {
  assertSalesBranchAccess,
  computeSalesOrderDiscountAmount,
  createSalesOrderSchema,
  nextSalesOrderNumber,
  roundCurrency,
  type CreateSalesOrderInput,
  type SalesOrderItemInput,
  type UpdateSalesOrderInput,
} from "../../utils/pos-sales";

const startOfTodayIso = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const isEmployeeContext = (context: Awaited<ReturnType<typeof requirePOSContextStrict>>) => context.role === "employee";

const assertEmployeeOwnTodayOrder = (
  context: Awaited<ReturnType<typeof requirePOSContextStrict>>,
  order: Record<string, any>,
) => {
  if (!isEmployeeContext(context)) {
    return;
  }

  const createdBy = String(order.created_by ?? "");
  const createdAt = String(order.created_at ?? "");
  if (createdBy !== context.userId || !createdAt || createdAt < startOfTodayIso()) {
    throw createError({ statusCode: 403, statusMessage: "Solo puedes operar tus ventas del dia." });
  }
};

async function buildSalesOrderItems(
  context: Awaited<ReturnType<typeof requirePOSContextStrict>>,
  branchId: string,
  customerSnapshot: { mode: "existing" | "walk_in"; customerId: string | null; fullName: string; phone: string | null; email?: string | null },
  items: SalesOrderItemInput[],
) {
  const categoriesMap = await getCategoriesMap(context);
  const rows: Array<Record<string, unknown>> = [];
  let subtotal = 0;

  for (const item of items) {
    if (item.itemType === "product") {
      const product = await getProductOrThrow(context, item.productId);
      const lineSubtotal = roundCurrency(Number(product.sale_price) * item.quantity);
      subtotal += lineSubtotal;
      const category = product.category_id ? categoriesMap.get(product.category_id) : null;
      rows.push({
        item_type: "product",
        organization_id: context.organizationId,
        branch_id: branchId,
        product_id: product.id,
        service_id: null,
        employee_id: null,
        scheduled_date: null,
        scheduled_time: null,
        quantity: item.quantity,
        unit_price: Number(product.sale_price),
        subtotal: lineSubtotal,
        snapshot_data: {
          title: product.name,
          subtitle: product.sku ? `SKU ${product.sku}` : category?.name ?? null,
          customer: customerSnapshot as unknown as Json,
          sku: product.sku,
          categoryId: product.category_id,
          categoryName: category?.name ?? null,
        } as Json,
      });
    } else {
      const service = await getPOSServiceOrThrow(context, item.serviceId);
      const employee = await getPOSEmployeeOrThrow(context, item.employeeId);
      const lineSubtotal = roundCurrency(Number(service.price));
      subtotal += lineSubtotal;
      const category = service.category_id ? categoriesMap.get(service.category_id) : null;
      rows.push({
        item_type: "service",
        organization_id: context.organizationId,
        branch_id: branchId,
        product_id: null,
        service_id: service.id,
        employee_id: employee.id,
        scheduled_date: item.scheduledDate,
        scheduled_time: item.scheduledTime,
        quantity: 1,
        unit_price: Number(service.price),
        subtotal: lineSubtotal,
        snapshot_data: {
          title: service.name,
          subtitle: `${employee.full_name} · ${item.scheduledDate} ${item.scheduledTime}`,
          customer: customerSnapshot as unknown as Json,
          employeeId: employee.id,
          employeeName: employee.full_name,
          categoryId: service.category_id,
          categoryName: category?.name ?? null,
        } as Json,
      });
    }
  }

  return { rows, subtotal: roundCurrency(subtotal) };
}

async function resolveCustomerSnapshot(context: Awaited<ReturnType<typeof requirePOSContextStrict>>, input: CreateSalesOrderInput["customer"]) {
  if (input.mode === "existing") {
    const customer = await getCustomerOrThrow(context, input.customerId);
    return {
      customerId: customer.id,
      snapshot: {
        mode: "existing" as const,
        customerId: customer.id,
        fullName: [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Cliente",
        phone: customer.phone,
        email: customer.email,
      },
    };
  }

  const anonymous = await getPOSAnonymousTemplateCustomerOrThrow(context);
  return {
    customerId: anonymous.id,
    snapshot: {
      mode: "walk_in" as const,
      customerId: anonymous.id,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      email: null,
    },
  };
}

export async function createSalesOrder(event: H3Event, payload: CreateSalesOrderInput) {
  const context = await requirePOSContextStrict(event, "can_create");
  const input = createSalesOrderSchema.parse(payload);

  const branch = await getPOSBranchOrThrow(context, input.branchId);
  assertBranchAccess(context, branch.id);
  assertSalesBranchAccess(context, branch.id);

  const { customerId, snapshot } = await resolveCustomerSnapshot(context, input.customer);
  const { rows, subtotal } = await buildSalesOrderItems(context, branch.id, snapshot, input.items);
  const discountAmount = computeSalesOrderDiscountAmount(subtotal, input.discount);
  const finalAmount = roundCurrency(Math.max(0, subtotal - discountAmount));
  const salesOrderNumber = await nextSalesOrderNumber(context);

  const { data: order, error: orderError } = await (context.adminClient as any)
    .from("sales_orders")
    .insert({
      organization_id: context.organizationId,
      branch_id: branch.id,
      sales_order_number: salesOrderNumber,
      created_by: context.userId,
      customer_mode: snapshot.mode,
      customer_id: customerId,
      customer_full_name: snapshot.fullName,
      customer_phone: snapshot.phone,
      customer_email: snapshot.email ?? null,
      discount_type: input.discount.type,
      discount_value: input.discount.value,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: 0,
      final_amount: finalAmount,
      note: input.note || null,
      status: input.status,
    })
    .select("*")
    .single();

  if (orderError || !order) {
    throw createError({ statusCode: 500, statusMessage: orderError?.message ?? "No se pudo crear la orden de venta." });
  }

  const itemPayload = rows.map((item) => ({ ...item, sales_order_id: order.id }));
  const { error: itemsError } = await (context.adminClient as any).from("sales_order_items").insert(itemPayload);
  if (itemsError) {
    throw createError({ statusCode: 500, statusMessage: itemsError.message });
  }

  return getSalesOrderById(event, order.id);
}

export async function getSalesOrders(event: H3Event, status?: string | null, branchId?: string | null) {
  const context = await requirePOSContextStrict(event, "can_view");
  const todayStart = startOfTodayIso();
  let query = (context.adminClient as any)
    .from("sales_orders")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }
  if (branchId) {
    assertSalesBranchAccess(context, branchId);
    query = query.eq("branch_id", branchId);
  }

  if (context.role !== "admin") {
    query = query.in("branch_id", context.allowedBranchIds);
  }
  if (isEmployeeContext(context)) {
    query = query.eq("created_by", context.userId).gte("created_at", todayStart);
  }

  const { data, error } = await query;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return { orders: data ?? [] };
}

export async function getSalesOrderById(event: H3Event, id: string) {
  const context = await requirePOSContextStrict(event, "can_view");
  const { data: order, error } = await (context.adminClient as any)
    .from("sales_orders")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: "Orden de venta no encontrada." });
  }
  assertSalesBranchAccess(context, order.branch_id);
  assertEmployeeOwnTodayOrder(context, order);

  const { data: items, error: itemsError } = await (context.adminClient as any)
    .from("sales_order_items")
    .select("*")
    .eq("sales_order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw createError({ statusCode: 500, statusMessage: itemsError.message });
  }

  return { order, items: items ?? [] };
}

export async function updateSalesOrder(event: H3Event, id: string, payload: UpdateSalesOrderInput) {
  const baseContext = await requirePOSContextStrict(event, "can_view");
  const context = baseContext.role === "employee"
    ? baseContext
    : await requirePOSContextStrict(event, "can_edit");
  const { data: existing, error } = await (context.adminClient as any)
    .from("sales_orders")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", id)
    .maybeSingle();

  if (error || !existing) {
    throw createError({ statusCode: 404, statusMessage: "Orden de venta no encontrada." });
  }
  assertSalesBranchAccess(context, existing.branch_id);
  assertEmployeeOwnTodayOrder(context, existing);
  if (existing.status === "charged" || existing.status === "cancelled") {
    throw createError({ statusCode: 409, statusMessage: "No se puede editar una orden cerrada." });
  }

  const input = payload;
  let customerSnapshot = {
    mode: existing.customer_mode as "existing" | "walk_in",
    customerId: existing.customer_id as string | null,
    fullName: existing.customer_full_name as string,
    phone: existing.customer_phone as string | null,
    email: existing.customer_email as string | null,
  };
  let customerId = existing.customer_id as string | null;

  if (input.customer) {
    const resolved = await resolveCustomerSnapshot(context, input.customer as CreateSalesOrderInput["customer"]);
    customerId = resolved.customerId;
    customerSnapshot = resolved.snapshot;
  }

  let subtotal = Number(existing.subtotal ?? 0);
  if (input.items) {
    const built = await buildSalesOrderItems(context, existing.branch_id, customerSnapshot, input.items);
    subtotal = built.subtotal;
    await (context.adminClient as any).from("sales_order_items").delete().eq("sales_order_id", existing.id);
    const toInsert = built.rows.map((item) => ({ ...item, sales_order_id: existing.id }));
    const { error: insertError } = await (context.adminClient as any).from("sales_order_items").insert(toInsert);
    if (insertError) {
      throw createError({ statusCode: 500, statusMessage: insertError.message });
    }
  }

  const discount = input.discount ?? {
    type: existing.discount_type as "none" | "percentage" | "fixed",
    value: Number(existing.discount_value ?? 0),
  };
  const discountAmount = computeSalesOrderDiscountAmount(subtotal, discount);
  const finalAmount = roundCurrency(Math.max(0, subtotal - discountAmount));

  const { error: updateError } = await (context.adminClient as any)
    .from("sales_orders")
    .update({
      customer_mode: customerSnapshot.mode,
      customer_id: customerId,
      customer_full_name: customerSnapshot.fullName,
      customer_phone: customerSnapshot.phone,
      customer_email: customerSnapshot.email,
      discount_type: discount.type,
      discount_value: discount.value,
      subtotal,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      note: input.note === undefined ? existing.note : input.note,
      status: input.status ?? existing.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  return getSalesOrderById(event, existing.id);
}
