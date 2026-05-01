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

  const supabase = useSupabaseClient();
  const { loadAccountStatus } = useAccountStatus();
  const { paymentRequired, snapshot } = await loadAccountStatus({
    organizationId: profile.organization_id,
  });

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
        subscription_status: snapshot.subscriptionStatus,
        trial_ends_at: snapshot.trialEndsAt,
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

  if (snapshot.organizationStatus === "pending") {
    return navigateTo("/dashboard?status=pending");
  }
});
