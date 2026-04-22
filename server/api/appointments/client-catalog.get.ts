import { requireAppointmentContext } from "../../utils/appointments";

import type { Database } from "@/types/database.types";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];

const parseServiceSkills = (value: Database["public"]["Tables"]["employee_branch_assignments"]["Row"]["skills"]): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

export default defineEventHandler(async (event) => {
  const context = await requireAppointmentContext(event);

  if (context.role !== "client") {
    throw createError({
      statusCode: 403,
      statusMessage: "Este catálogo solo está disponible para clientes autenticados.",
    });
  }

  const [{ data: branches, error: branchesError }, { data: services, error: servicesError }, { data: employees, error: employeesError }] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, organization_id, name, code, address, phone, is_active, settings, created_at, updated_at")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<BranchRow[]>(),
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
  ]);

  const firstError = branchesError ?? servicesError ?? employeesError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const employeeIds = (employees ?? []).map((employee) => employee.id);
  const branchIds = (branches ?? []).map((branch) => branch.id);
  const { data: assignments, error: assignmentsError } = employeeIds.length > 0 && branchIds.length > 0
    ? await context.adminClient
        .from("employee_branch_assignments")
        .select("*")
        .in("user_id", employeeIds)
        .in("branch_id", branchIds)
        .returns<AssignmentRow[]>()
    : { data: [] as AssignmentRow[], error: null };

  if (assignmentsError) {
    throw createError({
      statusCode: 500,
      statusMessage: assignmentsError.message,
    });
  }

  const assignmentRows = assignments ?? [];
  const employeesView = (employees ?? []).map((employee) => {
    const employeeAssignments = assignmentRows.filter((assignment) => assignment.user_id === employee.id);
    const primaryAssignment = employeeAssignments.find((assignment) => assignment.is_primary) ?? employeeAssignments[0] ?? null;
    const serviceIdsByBranch: Record<string, string[]> = {};

    for (const assignment of employeeAssignments) {
      serviceIdsByBranch[assignment.branch_id] = parseServiceSkills(assignment.skills);
    }

    return {
      ...employee,
      primaryBranchId: primaryAssignment?.branch_id ?? null,
      assignedBranchIds: Array.from(new Set(employeeAssignments.map((assignment) => assignment.branch_id))),
      serviceIdsByBranch,
    };
  });

  return {
    organizationId: context.organizationId,
    branches: branches ?? [],
    services: services ?? [],
    employees: employeesView,
  };
});
