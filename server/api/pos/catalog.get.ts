import {
  assertBranchAccess,
  requirePOSContext,
} from "../../utils/pos";

import type { Database } from "@/types/database.types";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);

  const branchFilter = context.role === "admin"
    ? context.adminClient
      .from("branches")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<BranchRow[]>()
    : context.adminClient
      .from("branches")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .in("id", context.allowedBranchIds)
      .order("name", { ascending: true })
      .returns<BranchRow[]>();

  const [{ data: branches, error: branchesError }, { data: categories, error: categoriesError }, { data: products, error: productsError }, { data: services, error: servicesError }, { data: employees, error: employeesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    branchFilter,
    context.adminClient
      .from("categories")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<CategoryRow[]>(),
    context.adminClient
      .from("products")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<ProductRow[]>(),
    context.adminClient
      .from("services")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<ServiceRow[]>(),
    context.adminClient
      .from("profiles")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .in("role", ["admin", "manager", "employee"])
      .order("full_name", { ascending: true })
      .returns<ProfileRow[]>(),
    context.adminClient
      .from("employee_branch_assignments")
      .select("*")
      .returns<AssignmentRow[]>(),
  ]);

  const firstError = branchesError ?? categoriesError ?? productsError ?? servicesError ?? employeesError ?? assignmentsError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const accessibleBranches = branches ?? [];
  const accessibleBranchIds = accessibleBranches.map((branch) => branch.id);
  const employeePrimaryBranchMap = new Map<string, string | null>();
  for (const assignment of assignments ?? []) {
    if (assignment.is_primary) {
      employeePrimaryBranchMap.set(assignment.user_id, assignment.branch_id);
      continue;
    }
    if (!employeePrimaryBranchMap.has(assignment.user_id)) {
      employeePrimaryBranchMap.set(assignment.user_id, assignment.branch_id);
    }
  }
  const employeeRows = (employees ?? []).filter((employee) => {
    if (context.role === "admin") {
      return true;
    }

    const primaryBranchId = employeePrimaryBranchMap.get(employee.id) ?? null;
    if (primaryBranchId && accessibleBranchIds.includes(primaryBranchId)) {
      return true;
    }

    return (assignments ?? []).some((assignment) => {
      return assignment.user_id === employee.id && accessibleBranchIds.includes(assignment.branch_id);
    });
  });

  const { data: inventory, error: inventoryError } = accessibleBranchIds.length > 0
    ? await context.adminClient
      .from("inventory_stock")
      .select("*")
      .in("branch_id", accessibleBranchIds)
      .returns<InventoryStockRow[]>()
    : { data: [], error: null };

  if (inventoryError) {
    throw createError({
      statusCode: 500,
      statusMessage: inventoryError.message,
    });
  }

  for (const branch of accessibleBranches) {
    assertBranchAccess(context, branch.id);
  }

  return {
    organizationId: context.organizationId,
    currentBranchId: context.allowedBranchIds[0] ?? null,
    branches: accessibleBranches,
    categories: categories ?? [],
    products: products ?? [],
    services: services ?? [],
    employees: employeeRows,
    assignments: assignments ?? [],
    inventory: inventory ?? [],
  };
});
