import { createClient } from "@supabase/supabase-js";
import { createError, getHeader } from "h3";

import type { Database } from "@/types/database.types";

import type { H3Event } from "h3";

type UserRole = Database["public"]["Enums"]["user_role"];
type ReportRole = Extract<UserRole, "admin" | "manager">;
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];

export interface ReportsResolvedContext {
  organizationId: string;
  role: ReportRole;
  timezone: string;
  branchIds: string[];
  assignedBranchId: string | null;
}

export interface ReportBranchOption {
  label: string;
  value: string;
}

export interface ReportEmployeeOption {
  label: string;
  value: string;
}

export interface ReportCategoryOption {
  label: string;
  value: string;
  kind: "product" | "service";
}

export interface ReportsFilterOptions {
  branches: ReportBranchOption[];
  employees: ReportEmployeeOption[];
  productCategories: ReportCategoryOption[];
  serviceCategories: ReportCategoryOption[];
  paymentMethods: Array<{ label: string; value: string }>;
}

export interface ReportsFilterSupportResult {
  context: ReportsResolvedContext;
  filterOptions: ReportsFilterOptions;
}

const REPORT_CONTEXT_ROLES = ["manager", "employee"] as const;
const REPORT_CATEGORY_TYPES = ["product", "service"] as const;

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se recibio un token de autenticacion valido.",
    });
  }

  return header.slice("Bearer ".length);
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuracion publica de Supabase esta incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para generar reportes desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

export async function requireReportsContext(event: H3Event): Promise<ReportsResolvedContext> {
  const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig(event);
  const token = getBearerToken(event);

  const authClient = createClient<Database, "public">(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se pudo validar la sesion del usuario.",
    });
  }

  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile?.organization_id || profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo validar el perfil para generar reportes.",
    });
  }

  if (profile.role !== "admin" && profile.role !== "manager") {
    throw createError({
      statusCode: 403,
      statusMessage: "Solo admin y manager pueden acceder a reportes.",
    });
  }

  const role = profile.role as ReportRole;
  const organizationId = profile.organization_id;

  const { data: branches, error: branchesError } = await adminClient
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (branchesError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar las sucursales para reportes.",
    });
  }

  const branchIds = (branches ?? []).map((branch) => branch.id);

  if (branchIds.length === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: "No hay sucursales disponibles para generar reportes.",
    });
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    organizationId,
    role,
    timezone,
    branchIds: role === "manager" ? [branchIds[0] ?? ""] : branchIds,
    assignedBranchId: role === "manager" ? branchIds[0] ?? null : null,
  };
}

export async function getReportsFilterSupport(
  event: H3Event,
  context: ReportsResolvedContext,
): Promise<ReportsFilterSupportResult> {
  const { url, serviceRoleKey } = getSupabaseServerConfig(event);
  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [
    { data: branches, error: branchesError },
    { data: employees, error: employeesError },
    { data: assignments, error: assignmentsError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    adminClient
      .from("branches")
      .select("id, name, code")
      .eq("organization_id", context.organizationId)
      .in("id", context.branchIds)
      .order("name", { ascending: true })
      .returns<Pick<BranchRow, "id" | "name" | "code">[]>(),
    adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", context.organizationId)
      .in("role", REPORT_CONTEXT_ROLES)
      .order("full_name", { ascending: true })
      .returns<Pick<ProfileRow, "id" | "full_name" | "role">[]>(),
    adminClient
      .from("employee_branch_assignments")
      .select("user_id, branch_id")
      .in("branch_id", context.branchIds)
      .returns<Pick<AssignmentRow, "user_id" | "branch_id">[]>(),
    adminClient
      .from("categories")
      .select("id, name, type")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .in("type", REPORT_CATEGORY_TYPES)
      .order("name", { ascending: true })
      .returns<Pick<CategoryRow, "id" | "name" | "type">[]>(),
  ]);

  const firstError = branchesError ?? employeesError ?? assignmentsError ?? categoriesError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const assignmentRows = assignments ?? [];
  const employeeRows = (employees ?? []).filter((employee) => {
    if (context.role === "admin") {
      return true;
    }

    return assignmentRows.some((assignment) =>
      assignment.user_id === employee.id && assignment.branch_id === context.assignedBranchId,
    );
  });

  const categoryRows = categories ?? [];
  const productCategories = categoryRows
    .filter((category) => category.type === "product")
    .map((category) => ({ label: category.name, value: category.id, kind: "product" as const }));
  const serviceCategories = categoryRows
    .filter((category) => category.type === "service")
    .map((category) => ({ label: category.name, value: category.id, kind: "service" as const }));

  return {
    context,
    filterOptions: {
      branches: (branches ?? []).map((branch) => ({ label: `${branch.name} (${branch.code})`, value: branch.id })),
      employees: employeeRows.map((employee) => ({ label: employee.full_name ?? "", value: employee.id })),
      productCategories,
      serviceCategories,
      paymentMethods: [
        { label: "Todos los metodos", value: "all" },
        { label: "Efectivo", value: "cash" },
        { label: "Tarjeta", value: "card" },
        { label: "Transferencia", value: "transfer" },
        { label: "Mixto", value: "mixed" },
        { label: "Billetera digital", value: "digital_wallet" },
      ],
    },
  };
}

