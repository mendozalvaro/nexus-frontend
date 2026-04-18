import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  parsePagination,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "system_users", "can_view");
  const { adminClient } = context;
  const { page, perPage, from, to } = parsePagination(event, 10);

  const { data, count, error } = await adminClient
    .from("system_users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<SystemUserRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar los usuarios system.",
    });
  }

  return {
    page,
    perPage,
    total: Number(count ?? 0),
    rows: data ?? [],
  };
});
