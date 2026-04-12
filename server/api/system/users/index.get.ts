import type { Database } from "@/types/database.types";
import {
  parsePagination,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];

export default defineEventHandler(async (event) => {
  const { adminClient } = await requireSystemAdminContext(event);
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
