import { createError } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const { data, error } = await context.adminClient
    .from("profiles")
    .select("id, full_name, email, role, organization_id, branch_id, avatar_url, phone")
    .eq("id", context.userId)
    .single();

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? "No se pudo cargar el perfil." });
  }

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 30, visibility: "private" });
  return data;
});
