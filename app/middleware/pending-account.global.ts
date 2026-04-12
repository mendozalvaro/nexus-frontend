import type { Database } from "@/types/database.types";
import { PENDING_ALLOWED_PATH_PREFIXES } from "@/config/navigation";

export default defineNuxtRouteMiddleware(async (to) => {
  const safePendingPrefixes = ["/auth", "/onboarding", ...PENDING_ALLOWED_PATH_PREFIXES];

  if (
    safePendingPrefixes.some((prefix) => to.path.startsWith(prefix)) ||
    to.path === "/" ||
    to.path === "/terms" ||
    to.path === "/privacy"
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
  const { data: organization } = await supabase
    .from("organizations")
    .select("status")
    .eq("id", profile.organization_id)
    .maybeSingle();

  if (organization?.status === "pending") {
    await supabase.from("audit_logs").insert({
      action: "INSERT",
      table_name: "pending_route_guard",
      record_id: profile.organization_id,
      user_id: user.id,
      context: {
        event: "PENDING_ROUTE_BLOCKED",
        attempted_path: to.fullPath,
        organization_id: profile.organization_id,
      },
    });

    return navigateTo("/dashboard?status=pending");
  }
});
