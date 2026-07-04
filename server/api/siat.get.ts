import { createError } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireStaffTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  const { data, error } = await (context.adminClient as any)
    .from("organization_siat_config")
    .select("*")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 60, visibility: "private" });
  return data;
});
