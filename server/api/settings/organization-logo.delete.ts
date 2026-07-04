import { throwApiError } from "../../utils/http-error";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "SETTINGS_LOGO_ADMIN_ONLY", "Solo administradores pueden actualizar el logo.");
  }

  const { data, error } = await context.adminClient
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", context.organizationId)
    .select("id, logo_url")
    .single();

  if (error || !data) {
    throwApiError(
      500,
      "SETTINGS_LOGO_REMOVE_ERROR",
      error?.message ?? "No se pudo quitar el logo de la organizacion.",
      { organizationId: context.organizationId },
    );
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return data;
});
