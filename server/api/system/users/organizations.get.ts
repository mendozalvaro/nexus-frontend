import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  parsePagination,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "organizations", "can_view");
  const { adminClient } = context;
  const { page, perPage, from, to } = parsePagination(event, 10);

  const { data, count, error } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, is_active, created_at, organization_id", {
      count: "exact",
    })
    .in("role", ["admin", "manager", "employee"])
    .not("organization_id", "is", null)
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<
      Array<
        Pick<
          ProfileRow,
          "id" | "full_name" | "email" | "role" | "is_active" | "created_at" | "organization_id"
        >
      >
    >();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar los usuarios de organizaciones.",
    });
  }

  const orgIds = Array.from(
    new Set(
      (data ?? [])
        .map((user) => user.organization_id)
        .filter((organizationId): organizationId is string => Boolean(organizationId)),
    ),
  );

  let orgsMap = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: organizations, error: organizationsError } = await adminClient
      .from("organizations")
      .select("id, name")
      .in("id", orgIds)
      .returns<Array<Pick<OrganizationRow, "id" | "name">>>();

    if (organizationsError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar las organizaciones vinculadas.",
      });
    }

    orgsMap = new Map((organizations ?? []).map((organization) => [organization.id, organization.name]));
  }

  const rows = (data ?? []).map((user) => {
    const organizationId = user.organization_id ?? "";

    return {
      id: user.id,
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      role: user.role ?? "employee",
      is_active: user.is_active ?? true,
      organization_id: organizationId,
      organization_name: orgsMap.get(organizationId) ?? "",
      created_at: user.created_at ?? "",
    };
  });

  return {
    page,
    perPage,
    total: Number(count ?? 0),
    rows,
  };
});
