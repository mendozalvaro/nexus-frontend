import { createError, getQuery } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";

const resolvePeriodDays = (period: string): number => {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
};

const UUID_V4_RELAXED_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeBranchId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return UUID_V4_RELAXED_REGEX.test(trimmed) ? trimmed : null;
};

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);
  const query = getQuery(event);

  const period = typeof query.period === "string" ? query.period : "30d";
  const days = resolvePeriodDays(period);
  const branchId = normalizeBranchId(query.branchId);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const salesQuery = context.adminClient
    .from("transactions")
    .select("final_amount")
    .eq("organization_id", context.organizationId)
    .gte("created_at", startDate);

  const appointmentsQuery = context.adminClient
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organizationId)
    .eq("status", "completed")
    .gte("start_time", startDate);

  const productsQuery = context.adminClient
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organizationId)
    .eq("is_active", true);

  const customersQuery = context.adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organizationId)
    .eq("role", "client");

  const [sales, appointments, products, customers] = await Promise.all([
    branchId ? salesQuery.eq("branch_id", branchId) : salesQuery,
    branchId ? appointmentsQuery.eq("branch_id", branchId) : appointmentsQuery,
    productsQuery,
    customersQuery,
  ]);

  const firstError = sales.error ?? appointments.error ?? products.error ?? customers.error;
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message });
  }

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return {
    sales: (sales.data ?? []).reduce((acc, item) => acc + Number(item.final_amount ?? 0), 0),
    appointments: appointments.count ?? 0,
    products: products.count ?? 0,
    customers: customers.count ?? 0,
    period,
    branchId,
  };
});
