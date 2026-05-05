import { createError } from "h3";

import type { TenantContext } from "../../utils/tenant-context";

export interface DashboardStatsParams {
  period: string;
  branchId: string | null;
}

export interface DashboardStatsResult {
  sales: number;
  appointments: number;
  products: number;
  customers: number;
  period: string;
  branchId: string | null;
}

const resolvePeriodDays = (period: string): number => {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
};

type TransactionRow = {
  final_amount: number;
};

export const getDashboardStats = async (
  context: TenantContext,
  params: DashboardStatsParams
): Promise<DashboardStatsResult> => {
  const periodDays = resolvePeriodDays(params.period);
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  let sales: { data: TransactionRow[] | null; error: Error | null };
  let appointments: { count: number | null; error: Error | null };
  let products: { count: number | null; error: Error | null };
  let customers: { count: number | null; error: Error | null };

  if (params.branchId) {
    const salesQuery = context.adminClient
      .from("transactions")
      .select("final_amount")
      .eq("organization_id", context.organizationId)
      .eq("branch_id", params.branchId)
      .gte("created_at", startDate)
      .returns<TransactionRow[]>();

    const appointmentsQuery = context.adminClient
      .from("appointments")
      .select("id", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .eq("branch_id", params.branchId)
      .eq("status", "completed")
      .gte("start_time", startDate);

    const productsQuery = context.adminClient
      .from("products")
      .select("id", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .eq("is_active", true);

    const customersQuery = context.adminClient
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .eq("role", "client");

    [sales, appointments, products, customers] = await Promise.all([
      salesQuery,
      appointmentsQuery,
      productsQuery,
      customersQuery,
    ]);
  } else {
    const salesQuery = context.adminClient
      .from("transactions")
      .select("final_amount")
      .eq("organization_id", context.organizationId)
      .gte("created_at", startDate)
      .returns<TransactionRow[]>();

    const appointmentsQuery = context.adminClient
      .from("appointments")
      .select("id", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .eq("status", "completed")
      .gte("start_time", startDate);

    const productsQuery = context.adminClient
      .from("products")
      .select("id", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .eq("is_active", true);

    const customersQuery = context.adminClient
      .from("profiles")
      .select("id", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .eq("role", "client");

    [sales, appointments, products, customers] = await Promise.all([
      salesQuery,
      appointmentsQuery,
      productsQuery,
      customersQuery,
    ]);
  }

  const firstError = sales.error ?? appointments.error ?? products.error ?? customers.error;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const totalSales = (sales.data ?? []).reduce(
    (acc: number, item: TransactionRow) => acc + Number(item.final_amount ?? 0),
    0
  );

  return {
    sales: totalSales,
    appointments: appointments.count ?? 0,
    products: products.count ?? 0,
    customers: customers.count ?? 0,
    period: params.period,
    branchId: params.branchId,
  };
};