import { createError } from "h3";
import type { H3Event } from "h3";

import { requirePOSContextStrict } from "../../utils/pos";
import { nextProformaNumber } from "../../utils/pos-sales";
import { getSalesOrderById } from "./sales-orders";

const startOfTodayIso = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const isEmployeeContext = (context: Awaited<ReturnType<typeof requirePOSContextStrict>>) => context.role === "employee";

const assertEmployeeOwnTodayProforma = (
  context: Awaited<ReturnType<typeof requirePOSContextStrict>>,
  proforma: Record<string, any>,
) => {
  if (!isEmployeeContext(context)) {
    return;
  }

  const issuedBy = String(proforma.issued_by ?? "");
  const issuedAt = String(proforma.issued_at ?? "");
  if (issuedBy !== context.userId || !issuedAt || issuedAt < startOfTodayIso()) {
    throw createError({ statusCode: 403, statusMessage: "Solo puedes operar tus proformas del dia." });
  }
};

export async function issueProforma(event: H3Event, salesOrderId: string) {
  const baseContext = await requirePOSContextStrict(event, "can_view");
  const context = baseContext.role === "employee"
    ? baseContext
    : await requirePOSContextStrict(event, "can_edit");
  const orderResult = await getSalesOrderById(event, salesOrderId);
  const { order, items } = orderResult;

  if (order.status === "cancelled" || order.status === "charged") {
    throw createError({ statusCode: 409, statusMessage: "Solo se pueden emitir proformas de órdenes activas." });
  }

  const proformaNumber = await nextProformaNumber(context);
  const snapshot = {
    order,
    items,
    issuedAt: new Date().toISOString(),
  };

  const { data, error } = await (context.adminClient as any)
    .from("sales_proformas")
    .insert({
      organization_id: context.organizationId,
      branch_id: order.branch_id,
      sales_order_id: order.id,
      proforma_number: proformaNumber,
      status: "issued",
      snapshot,
      issued_by: context.userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? "No se pudo emitir la proforma." });
  }

  return { proforma: data };
}

export async function getProformas(event: H3Event, status?: string | null) {
  const context = await requirePOSContextStrict(event, "can_view");
  const todayStart = startOfTodayIso();
  let query = (context.adminClient as any)
    .from("sales_proformas")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("issued_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }
  if (context.role !== "admin") {
    query = query.in("branch_id", context.allowedBranchIds);
  }
  if (isEmployeeContext(context)) {
    query = query.eq("issued_by", context.userId).gte("issued_at", todayStart);
  }

  const { data, error } = await query;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { proformas: data ?? [] };
}

export async function resumeFromProforma(event: H3Event, proformaId: string) {
  const baseContext = await requirePOSContextStrict(event, "can_view");
  const context = baseContext.role === "employee"
    ? baseContext
    : await requirePOSContextStrict(event, "can_edit");
  const { data: proforma, error } = await (context.adminClient as any)
    .from("sales_proformas")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", proformaId)
    .maybeSingle();

  if (error || !proforma) {
    throw createError({ statusCode: 404, statusMessage: "Proforma no encontrada." });
  }
  assertEmployeeOwnTodayProforma(context, proforma);
  if (proforma.status !== "issued") {
    throw createError({ statusCode: 409, statusMessage: "Solo se pueden retomar proformas emitidas." });
  }

  const { error: updateError } = await (context.adminClient as any)
    .from("sales_proformas")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", proforma.id)
    .eq("status", "issued");

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  return getSalesOrderById(event, proforma.sales_order_id);
}
