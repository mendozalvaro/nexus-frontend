import type { Database } from "@/types/database.types";

import { getDefaultPathForRole } from "../utils/role-access";

export default defineNuxtRouteMiddleware(async () => {
  const { ensureAuthContext } = useAuthContext();
  const { user, profile } = await ensureAuthContext({ requireProfile: true });

  if (!user) {
    return navigateTo("/auth/login");
  }

  if (!profile?.organization_id) {
    return navigateTo("/onboarding/organization");
  }

  if (profile.role === "client") {
    return navigateTo(getDefaultPathForRole(profile.role));
  }

  const supabase = useSupabaseClient<Database>();
  const [{ data: organization, error: organizationError }, {
    data: subscription,
    error: subscriptionError,
  }, {
    data: validation,
    error: validationError,
  }] = await Promise.all([
    supabase
      .from("organizations")
      .select("status")
      .eq("id", profile.organization_id)
      .maybeSingle(),
    supabase
      .from("organization_subscriptions")
      .select("status")
      .eq("organization_id", profile.organization_id)
      .maybeSingle(),
    supabase
      .from("payment_validations")
      .select("status")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (organizationError || subscriptionError || validationError) {
    return;
  }

  if (organization?.status === "active" && subscription?.status === "active") {
    return navigateTo(getDefaultPathForRole(profile.role));
  }

  if (profile.role === "admin" && !validation) {
    return navigateTo("/onboarding/payment");
  }

  return;
});
