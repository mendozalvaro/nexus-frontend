import { CACHE_KEYS } from "@/utils/cache-keys";

export default defineNuxtPlugin(async () => {
  const user = useSupabaseUser();

  if (!user.value) return;

  const metadata = (user.value.user_metadata ?? {}) as Record<string, unknown>;
  const role = typeof metadata.role === "string" ? metadata.role : null;
  const organizationId = typeof metadata.organization_id === "string"
    ? metadata.organization_id
    : null;

  // System/support users do not have tenant context and must not hit tenant endpoints.
  if (role === "system" || role === "support" || !organizationId) {
    return;
  }

  await useFetch("/api/initial-data", {
    key: CACHE_KEYS.initialData,
    lazy: false,
    dedupe: "defer",
    default: () => ({
      organization: null,
      profile: null,
      subscription: null,
      plan: null,
      branches: [],
    }),
  });
});
