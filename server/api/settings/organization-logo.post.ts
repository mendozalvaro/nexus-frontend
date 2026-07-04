import { throwApiError } from "../../utils/http-error";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";
import { buildOrganizationLogoStoragePath } from "@/utils/onboarding";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "SETTINGS_LOGO_ADMIN_ONLY", "Solo administradores pueden actualizar el logo.");
  }

  const formData = await readFormData(event);
  const rawFile = formData.get("logo");

  if (!rawFile || !(rawFile instanceof File)) {
    throwApiError(400, "SETTINGS_LOGO_MISSING", "No se envio ningun archivo de logo.");
  }

  const logoFile = rawFile as File;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSizeBytes = 2 * 1024 * 1024;

  if (!allowedTypes.includes(logoFile.type)) {
    throwApiError(400, "SETTINGS_LOGO_INVALID_TYPE", "El logo debe ser JPG, PNG o WebP.");
  }

  if (logoFile.size > maxSizeBytes) {
    throwApiError(400, "SETTINGS_LOGO_TOO_LARGE", "El logo supera el limite de 2MB.");
  }

  const buffer = Buffer.from(await logoFile.arrayBuffer());
  const storagePath = buildOrganizationLogoStoragePath(context.userId, context.organizationId, logoFile.type);

  const { error: uploadError } = await context.adminClient.storage
    .from("organization-assets")
    .upload(storagePath, buffer, { upsert: true, contentType: logoFile.type });

  if (uploadError) {
    throwApiError(
      500,
      "SETTINGS_LOGO_UPLOAD_ERROR",
      uploadError.message,
      { storagePath },
    );
  }

  const { data: urlData } = context.adminClient.storage
    .from("organization-assets")
    .getPublicUrl(storagePath);

  const logoUrl = urlData.publicUrl;

  const { data, error: updateError } = await context.adminClient
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", context.organizationId)
    .select("id, logo_url")
    .single();

  if (updateError || !data) {
    throwApiError(
      500,
      "SETTINGS_LOGO_UPDATE_ERROR",
      updateError?.message ?? "No se pudo actualizar el logo en la organizacion.",
      { organizationId: context.organizationId },
    );
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return data;
});
