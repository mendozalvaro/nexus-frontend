import type { Database } from "@/types/database.types";

export default defineNuxtRouteMiddleware(async () => {
  const { ensureAuthContext } = useAuthContext();
  const { user } = await ensureAuthContext();

  if (!user) {
    return navigateTo("/auth/login");
  }

  const supabase = useSupabaseClient<Database>();
  const { data, error } = await supabase
    .from("system_users")
    .select("user_id, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active || data.role !== "system") {
    return navigateTo("/dashboard");
  }

  return;
});
