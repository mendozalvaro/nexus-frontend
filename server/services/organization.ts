import { createError } from "h3";

import type { TenantContext } from "../utils/tenant-context";

export const getOrganization = async (context: TenantContext) => {
  const { data, error } = await context.adminClient
    .from("organizations")
    .select("id, name, slug, timezone, currency_code, country, address, logo_url, is_active, default_receipt_format, lodging_checkout_deadline, lodging_stay_cutoff_time, lodging_late_checkout_penalty, updated_at")
    .eq("id", context.organizationId)
    .single();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo cargar la organizacion.",
    });
  }

  return data;
};
