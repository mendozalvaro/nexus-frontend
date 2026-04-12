import type { Database } from "@/types/database.types";
import { parsePagination, requireSystemAdminContext } from "../../../utils/system-admin";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default defineEventHandler(async (event) => {
  const { adminClient } = await requireSystemAdminContext(event);
  const { page, perPage, from, to } = parsePagination(event, 10);

  const { data, count, error } = await adminClient
    .from("profiles")
    .select("id, full_name, email, is_active, created_at", { count: "exact" })
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<Array<Pick<ProfileRow, "id" | "full_name" | "email" | "is_active" | "created_at">>>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar los usuarios cliente.",
    });
  }

  return {
    page,
    perPage,
    total: Number(count ?? 0),
    rows: (data ?? []).map((user) => ({
      id: user.id,
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      is_active: user.is_active ?? true,
      created_at: user.created_at ?? "",
    })),
  };
});
