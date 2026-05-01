import { createError } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const { data, error } = await context.adminClient
    .from("organization_subscriptions")
    .select(`
      id, status, current_period_end,
      plan:subscription_plans(
        id, name, slug, price_monthly, price_yearly,
        max_branches, max_users,
        feature_multi_branch, feature_manager_role,
        feature_inventory_transfer, feature_api_access,
        feature_forensic_export, feature_advanced_reports, feature_white_label
      )
    `)
    .eq("organization_id", context.organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  setCacheHeaders(event, { sMaxAge: 600, staleWhileRevalidate: 120, visibility: "private" });
  return data;
});
