import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";

export interface BranchRow {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  settings: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export type BranchWeekday =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export interface BranchBusinessHour {
  isOpen: boolean;
  open: string;
  close: string;
}

export type BranchBusinessHours = Record<BranchWeekday, BranchBusinessHour>;

export interface BranchSettings {
  businessHours: BranchBusinessHours;
}

export interface BranchStats {
  salesTotal: number;
  salesCount: number;
  employeesCount: number;
  appointmentsCount: number;
  lowStockCount: number;
}

export interface BranchListItem {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  settings: BranchSettings;
  stats: BranchStats;
}

const defaultBusinessHours: BranchBusinessHours = {
  monday: { isOpen: true, open: "09:00", close: "18:00" },
  tuesday: { isOpen: true, open: "09:00", close: "18:00" },
  wednesday: { isOpen: true, open: "09:00", close: "18:00" },
  thursday: { isOpen: true, open: "09:00", close: "18:00" },
  friday: { isOpen: true, open: "09:00", close: "18:00" },
  saturday: { isOpen: false, open: "09:00", close: "13:00" },
  sunday: { isOpen: false, open: "09:00", close: "13:00" },
};

export function normalizeSettings(raw: unknown): BranchSettings {
  const businessHours = raw && typeof raw === "object" && "businessHours" in raw
    ? { ...defaultBusinessHours, ...(raw.businessHours as Partial<BranchBusinessHours>) }
    : { ...defaultBusinessHours };

  return { businessHours };
}

export function buildStatsMaps(
  branchIds: string[],
  transactions: Array<{ branch_id: string; final_amount: number | null }>,
  appointments: Array<{ id: string; branch_id: string }>,
  profiles: Array<{ id: string; is_active: boolean | null; role: string | null }>,
  assignments: Array<{ branch_id: string; user_id: string }>,
  inventory: Array<{ branch_id: string; quantity: number | null; min_stock_level: number | null }>,
) {
  const salesMap = new Map<string, { total: number; count: number }>();
  const appointmentMap = new Map<string, number>();
  const employeeMap = new Map<string, Set<string>>();
  const lowStockMap = new Map<string, number>();

  for (const branchId of branchIds) {
    salesMap.set(branchId, { total: 0, count: 0 });
    appointmentMap.set(branchId, 0);
    employeeMap.set(branchId, new Set());
    lowStockMap.set(branchId, 0);
  }

  for (const transaction of transactions) {
    const current = salesMap.get(transaction.branch_id);
    if (!current) continue;
    current.total += transaction.final_amount ?? 0;
    current.count += 1;
  }

  for (const appointment of appointments) {
    appointmentMap.set(
      appointment.branch_id,
      (appointmentMap.get(appointment.branch_id) ?? 0) + 1,
    );
  }

  const activeStaffUserIds = new Set(
    profiles
      .filter((p) => p.is_active !== false && p.role !== "client" && p.role !== "admin")
      .map((p) => p.id),
  );

  for (const assignment of assignments) {
    if (!activeStaffUserIds.has(assignment.user_id)) continue;
    employeeMap.get(assignment.branch_id)?.add(assignment.user_id);
  }

  for (const row of inventory) {
    const quantity = row.quantity ?? 0;
    const minStockLevel = row.min_stock_level ?? 0;
    if (quantity <= minStockLevel) {
      lowStockMap.set(row.branch_id, (lowStockMap.get(row.branch_id) ?? 0) + 1);
    }
  }

  return { salesMap, appointmentMap, employeeMap, lowStockMap };
}

export const getBranchesList = async (context: InventoryContext) => {
  const { data: branches, error: branchesError } = await context.adminClient
    .from("branches")
    .select("id, organization_id, name, code, address, phone, settings, is_active, created_at, updated_at")
    .eq("organization_id", context.organizationId)
    .order("name", { ascending: true });

  if (branchesError) {
    throw createError({ statusCode: 500, statusMessage: branchesError.message });
  }

  const branchRows = branches ?? [];
  const branchIds = branchRows.map((b) => b.id);

  if (branchIds.length === 0) {
    return [];
  }

  const [
    transactionsResult,
    appointmentsResult,
    profilesResult,
    assignmentsResult,
    inventoryResult,
  ] = await Promise.all([
    context.adminClient.from("transactions").select("branch_id, final_amount")
      .eq("organization_id", context.organizationId).in("branch_id", branchIds),
    context.adminClient.from("appointments").select("id, branch_id")
      .eq("organization_id", context.organizationId).in("branch_id", branchIds),
    context.adminClient.from("profiles").select("id, is_active, role")
      .eq("organization_id", context.organizationId).neq("role", "client"),
    context.adminClient.from("employee_branch_assignments").select("branch_id, user_id")
      .in("branch_id", branchIds),
    context.adminClient.from("inventory_stock").select("branch_id, quantity, min_stock_level")
      .in("branch_id", branchIds),
  ]);

  const firstError = transactionsResult.error ?? appointmentsResult.error
    ?? profilesResult.error ?? assignmentsResult.error ?? inventoryResult.error;

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message });
  }

  const { salesMap, appointmentMap, employeeMap, lowStockMap } = buildStatsMaps(
    branchIds,
    transactionsResult.data ?? [],
    appointmentsResult.data ?? [],
    profilesResult.data ?? [],
    assignmentsResult.data ?? [],
    inventoryResult.data ?? [],
  );

  return branchRows.map((branch): BranchListItem => {
    const sales = salesMap.get(branch.id) ?? { total: 0, count: 0 };
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.is_active ?? true,
      createdAt: branch.created_at,
      updatedAt: branch.updated_at,
      settings: normalizeSettings(branch.settings as unknown),
      stats: {
        salesTotal: sales.total,
        salesCount: sales.count,
        employeesCount: employeeMap.get(branch.id)?.size ?? 0,
        appointmentsCount: appointmentMap.get(branch.id) ?? 0,
        lowStockCount: lowStockMap.get(branch.id) ?? 0,
      },
    };
  });
};
