import { setCacheHeaders } from "../utils/cache";
import { throwApiError } from "../utils/http-error";
import { requireTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const { data, error } = await context.adminClient
    .from("profiles")
    .select("id, full_name, email, role, organization_id, avatar_url, phone")
    .eq("id", context.userId)
    .single();

  if (error || !data) {
    throwApiError(
      500,
      "AUTH_PROFILE_FETCH_ERROR",
      error?.message ?? "No se pudo cargar el perfil.",
      { userId: context.userId, organizationId: context.organizationId },
    );
  }

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 30, visibility: "private" });
  return data;
});
