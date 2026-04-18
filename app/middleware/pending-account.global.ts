import type { Database } from "@/types/database.types";
import { PENDING_ALLOWED_PATH_PREFIXES } from "@/config/navigation";

export default defineNuxtRouteMiddleware(async (to) => {
  const safePublicPrefixes = ["/auth"];
  const safePublicPaths = ["/", "/terms", "/privacy"];
  const paymentOnlyPath = "/onboarding/payment";

  if (
    safePublicPrefixes.some((prefix) => to.path.startsWith(prefix)) ||
    safePublicPaths.includes(to.path)
  ) {
    return;
  }

  const { ensureAuthContext } = useAuthContext();
  const { user, profile } = await ensureAuthContext({ requireProfile: true });
  if (!user) {
    return;
  }

  if (!profile?.organization_id) {
    return;
  }

  if (profile.role === "client") {
    return;
  }

  const supabase = useSupabaseClient<Database>();
  const [{ data: organization }, { data: subscription }] = await Promise.all([
    supabase
      .from("organizations")
      .select("status")
      .eq("id", profile.organization_id)
      .maybeSingle(),
    supabase
      .from("organization_subscriptions")
      .select("status, is_trial, trial_ends_at")
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const now = Date.now();
  const trialEndsAt =
    typeof subscription?.trial_ends_at === "string"
      ? new Date(subscription.trial_ends_at).getTime()
      : null;
  const trialExpired =
    typeof trialEndsAt === "number" && Number.isFinite(trialEndsAt) && trialEndsAt <= now;

  const paymentRequired = Boolean(
    subscription
    && subscription.status !== "active"
    && (subscription.is_trial !== true || trialExpired || trialEndsAt === null),
  );

  if (paymentRequired && !to.path.startsWith(paymentOnlyPath)) {
    await supabase.from("audit_logs").insert({
      action: "INSERT",
      table_name: "payment_required_route_guard",
      record_id: profile.organization_id,
      user_id: user.id,
      context: {
        event: "PAYMENT_REQUIRED_ROUTE_BLOCKED",
        attempted_path: to.fullPath,
        organization_id: profile.organization_id,
        subscription_status: subscription?.status ?? null,
        trial_ends_at: subscription?.trial_ends_at ?? null,
      },
    });

    return navigateTo(paymentOnlyPath);
  }

  const safePendingPrefixes = [paymentOnlyPath, ...PENDING_ALLOWED_PATH_PREFIXES];
  if (
    safePendingPrefixes.some((prefix) => to.path.startsWith(prefix))
    || to.path.startsWith("/onboarding")
  ) {
    return;
  }

  if (organization?.status === "pending") {
    return navigateTo("/dashboard?status=pending");
  }
});
