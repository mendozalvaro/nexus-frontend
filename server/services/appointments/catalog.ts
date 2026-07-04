import { requireAppointmentContextStrict } from "../../utils/appointments";

import type { Database } from "@/types/database.types";

import type { H3Event } from "h3";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type UserRole = Database["public"]["Enums"]["user_role"];

const parseServiceSkills = (value: Database["public"]["Tables"]["employee_branch_assignments"]["Row"]["skills"]): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

export interface AppointmentCatalogBranch {
  id: string;
  name: string;
  code: string;
  address: string | null;
}

export interface AppointmentCatalogService {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface AppointmentCatalogEmployee {
  id: string;
  fullName: string;
  primaryBranchId: string | null;
  assignedBranchIds: string[];
  serviceIdsByBranch: Record<string, string[]>;
  role: UserRole;
}

export interface AppointmentCatalogResult {
  organizationId: string;
  branches: AppointmentCatalogBranch[];
  services: AppointmentCatalogService[];
  employees: AppointmentCatalogEmployee[];
}

export async function getAppointmentCatalog(
  event: H3Event,
  scopeRole: "admin" | "manager" | "employee",
  currentProfileId: string,
): Promise<AppointmentCatalogResult> {
  const context = await requireAppointmentContextStrict(event);

  if (!context.profile.organization_id) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se encontro la organizacion asociada a tu perfil.",
    });
  }

  const organizationId = context.profile.organization_id;

  const [
    { data: branches, error: branchesError },
    { data: services, error: servicesError },
    { data: employees, error: employeesError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, name, code, address")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Pick<BranchRow, "id" | "name" | "code" | "address">[]>(),
    context.adminClient
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Pick<ServiceRow, "id" | "name" | "duration_minutes" | "price">[]>(),
    context.adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", ["admin", "manager", "employee"])
      .order("full_name", { ascending: true })
      .returns<Array<Pick<ProfileRow, "id" | "full_name" | "role">>>(),
    context.adminClient
      .from("employee_branch_assignments")
      .select("user_id, branch_id, is_primary, skills")
      .returns<AssignmentRow[]>(),
  ]);

  const firstError = branchesError ?? servicesError ?? employeesError ?? assignmentsError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const assignmentsByEmployee = new Map<string, string[]>();
  const primaryBranchByEmployee = new Map<string, string | null>();
  const serviceCoverageByEmployee = new Map<string, Record<string, string[]>>();

  for (const assignment of assignments ?? []) {
    const current = assignmentsByEmployee.get(assignment.user_id) ?? [];
    current.push(assignment.branch_id);
    assignmentsByEmployee.set(assignment.user_id, current);

    if (assignment.is_primary) {
      primaryBranchByEmployee.set(assignment.user_id, assignment.branch_id);
    } else if (!primaryBranchByEmployee.has(assignment.user_id)) {
      primaryBranchByEmployee.set(assignment.user_id, assignment.branch_id);
    }

    const currentCoverage = serviceCoverageByEmployee.get(assignment.user_id) ?? {};
    currentCoverage[assignment.branch_id] = parseServiceSkills(assignment.skills);
    serviceCoverageByEmployee.set(assignment.user_id, currentCoverage);
  }

  const branchOptions = (branches ?? []).map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
  }));

  const employeeOptions = (employees ?? []).map((employee) => ({
    id: employee.id,
    fullName: employee.full_name,
    primaryBranchId: primaryBranchByEmployee.get(employee.id) ?? null,
    assignedBranchIds: Array.from(new Set(assignmentsByEmployee.get(employee.id) ?? [])),
    serviceIdsByBranch: serviceCoverageByEmployee.get(employee.id) ?? {},
    role: employee.role ?? "employee",
  }));

  const managerBranchId = scopeRole === "manager"
    ? (primaryBranchByEmployee.get(currentProfileId) ?? null)
    : null;

  const filteredBranches = managerBranchId
    ? branchOptions.filter((branch) => branch.id === managerBranchId)
    : branchOptions;

  const filteredEmployees = managerBranchId
    ? employeeOptions.filter((employee) => employee.primaryBranchId === managerBranchId || employee.assignedBranchIds.includes(managerBranchId))
    : scopeRole === "employee"
      ? employeeOptions.filter((employee) => employee.id === currentProfileId)
      : employeeOptions;

  return {
    organizationId,
    branches: filteredBranches,
    services: (services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      price: service.price,
    })),
    employees: filteredEmployees,
  };
}
