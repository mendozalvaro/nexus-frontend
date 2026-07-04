export const useGlobalUserProfile = () => {
  const route = useRoute();
  const { user, profile, contextBootstrapState, refreshProfile } = useUserContext();
  const { ensureAuthContext } = useAuthContext();

  const shouldFetchTenantProfile = computed(() => {
    if (
      route.path === "/"
      || route.path.startsWith("/auth")
      || route.path.startsWith("/client")
      || route.path === "/terms"
      || route.path === "/privacy"
      || route.path.startsWith("/system")
    ) {
      return false;
    }

    const currentUser = user.value;
    if (!currentUser) {
      return false;
    }

    const metadata = (currentUser.user_metadata ?? {}) as Record<string, unknown>;
    const role = typeof metadata.role === "string" ? metadata.role : null;

    return role !== "system" && role !== "support" && role !== "client";
  });

  const loading = computed(() =>
    shouldFetchTenantProfile.value
    && contextBootstrapState.value === "resolving"
    && !profile.value,
  );

  watch(
    () => ({
      enabled: shouldFetchTenantProfile.value,
      userId: user.value?.id ?? null,
      profileId: profile.value?.id ?? null,
    }),
    async ({ enabled, userId, profileId }) => {
      if (!enabled || !user.value) {
        return;
      }

      if (profileId === userId) {
        return;
      }

      await ensureAuthContext({ requireProfile: true });
    },
    { immediate: true },
  );

  return {
    profile,
    loading,
    error: computed(() => null),
    refreshProfile,
  };
};
