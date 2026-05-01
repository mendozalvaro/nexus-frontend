import { createError } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const { data, error } = await context.adminClient
    .from("organizations")
    .select("id, name, slug, timezone, currency_code, status, logo_url, address")
    .eq("id", context.organizationId)
    .single();

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: error?.message ?? "No se pudo cargar la organizacion." });
  }

  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 60, visibility: "private" });
  return data;
});
