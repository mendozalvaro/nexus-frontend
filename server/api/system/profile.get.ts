import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../utils/system-admin";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "system_users", "can_view");
  const { adminClient, userId } = context;

  const { data, error } = await adminClient
    .from("system_users")
    .select("user_id, email, full_name, role, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle<
      Pick<
        SystemUserRow,
        "user_id" | "email" | "full_name" | "role" | "is_active" | "created_at" | "updated_at"
      >
    >();

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se pudo cargar el perfil system.",
    });
  }

  return {
    row: data,
  };
});
