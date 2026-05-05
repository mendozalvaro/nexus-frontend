import { createError } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  if (context.role !== "admin" && context.role !== "manager") {
    throw createError({ statusCode: 403, statusMessage: "No autorizado" });
  }

  const { data, error } = await context.adminClient
    .from("branches")
    .select("id, name, code, is_active")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 60, visibility: "private" });
  return data ?? [];
});
