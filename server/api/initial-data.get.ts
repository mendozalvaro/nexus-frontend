import { createError } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const [organization, profile, subscription, branches] = await Promise.all([
    context.adminClient
      .from("organizations")
      .select("id, name, slug, timezone, currency_code, status, logo_url, address")
      .eq("id", context.organizationId)
      .single(),
    context.adminClient
      .from("profiles")
      .select("id, full_name, email, role, organization_id, avatar_url, phone")
      .eq("id", context.userId)
      .single(),
    context.adminClient
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
      .maybeSingle(),
    context.role === "admin"
      ? context.adminClient
        .from("branches")
        .select("id, name, code, is_active")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
      : context.adminClient
        .from("employee_branch_assignments")
        .select("branch_id, branches(id, name, code, is_active)")
        .eq("user_id", context.userId),
  ]);

  if (organization.error || !organization.data) {
    throw createError({ statusCode: 500, statusMessage: organization.error?.message ?? "No se pudo cargar organizacion." });
  }

  if (profile.error || !profile.data) {
    throw createError({ statusCode: 500, statusMessage: profile.error?.message ?? "No se pudo cargar perfil." });
  }

  if (subscription.error) {
    throw createError({ statusCode: 500, statusMessage: subscription.error.message });
  }

  if (branches.error) {
    throw createError({ statusCode: 500, statusMessage: branches.error.message });
  }

  const normalizedBranches = context.role === "admin"
    ? (branches.data ?? [])
    : ((branches.data as Array<{ branches: unknown }> | null) ?? [])
      .map((assignment) => assignment.branches)
      .filter(Boolean);

  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 60, visibility: "private" });

  return {
    organization: organization.data,
    profile: profile.data,
    subscription: subscription.data,
    plan: subscription.data?.plan ?? null,
    branches: normalizedBranches,
  };
});
