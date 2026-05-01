import type { User } from "@supabase/supabase-js";

import type { Profile, UserRole } from "@/types/auth";
import type { PermissionGrant } from "@/types/permissions";
import type { Database } from "@/types/database.types";

const PROFILE_CACHE_TTL_MS = 30_000;
const DEFAULT_ACCOUNT_STATUS = "active";

const sanitizeString = (value: string | null | undefined): string => {
  return value?.trim() ?? "";
};

const sanitizeNullableString = (value: string | null | undefined): string | null => {
  const sanitized = sanitizeString(value);
  return sanitized.length > 0 ? sanitized : null;
};

const getUserMetadata = (user: User | null): Record<string, unknown> => {
  return (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
};

const getMetadataOrganizationId = (user: User | null): string | null => {
  const organizationId = getUserMetadata(user).organization_id;
  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
};

const getMetadataRole = (user: User | null): UserRole | null => {
  const role = getUserMetadata(user).role;
  return typeof role === "string" ? (role as UserRole) : null;
};

export interface EnsureUserContextOptions {
  requireProfile?: boolean;
  forceProfileRefresh?: boolean;
  forceUserValidation?: boolean;
}

export const useUserContext = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { resolveUser } = useSessionAccess();

  const user = useState<User | null>("user-context:user", () => null);
  const profile = useState<Profile | null>("auth:profile", () => null);
  const profileLoading = useState<boolean>("user-context:profile-loading", () => false);
  const profileFetchedForUserId = useState<string | null>("auth:profile:fetched-user-id", () => null);
  const profileFetchedAt = useState<number>("auth:profile:fetched-at", () => 0);

  const roleState = useState<UserRole | null>("user-context:role", () => null);
  const organizationIdState = useState<string | null>("user-context:organization-id", () => null);
  const activeOrganizationIdState = useState<string | null>("user-context:active-organization-id", () => null);
  const activeOrganizationSlugState = useState<string | null>("user-context:active-organization-slug", () => null);

  const selectedBranchId = useState<string | null>("branch-selector:selected-branch-id", () => null);
  const accountStatus = useState<"pending" | "active" | "rejected" | "suspended">(
    "user-context:account-status",
    () => DEFAULT_ACCOUNT_STATUS,
  );
  const paymentRequired = useState<boolean>("user-context:payment-required", () => false);
  const permissionGrants = useState<PermissionGrant[]>("user-context:permission-grants", () => []);
  const permissionsRevision = useState<number>("user-context:permissions-revision", () => 0);

  const contextWatcherInitialized = useState<boolean>("user-context:watcher-initialized", () => false);
  const lastContextUserId = useState<string | null>("user-context:last-user-id", () => null);
  const lastContextOrganizationId = useState<string | null>("user-context:last-org-id", () => null);

  const role = computed<UserRole | null>(() => roleState.value);
  const organizationId = computed<string | null>(() => organizationIdState.value);
  const activeOrganizationId = computed<string | null>(() => {
    return activeOrganizationIdState.value ?? organizationIdState.value;
  });
  const organizationContext = computed(() => ({
    activeOrganizationId: activeOrganizationId.value,
    activeOrganizationSlug: activeOrganizationSlugState.value,
  }));

  const isAdmin = computed(() => role.value === "admin");
  const isManager = computed(() => role.value === "manager");
  const isEmployee = computed(() => role.value === "employee");
  const isClient = computed(() => role.value === "client");
  const isBranchScopedRole = computed(() => isManager.value || isEmployee.value);

  const syncFromCurrentUser = (currentUser: User | null) => {
    user.value = currentUser;

    if (!currentUser) {
      roleState.value = null;
      organizationIdState.value = null;
      activeOrganizationIdState.value = null;
      activeOrganizationSlugState.value = null;
      return;
    }

    if (profile.value && profile.value.id === currentUser.id) {
      roleState.value = profile.value.role;
      organizationIdState.value = profile.value.organization_id;
      if (!activeOrganizationIdState.value) {
        activeOrganizationIdState.value = profile.value.organization_id;
      }
      return;
    }

    roleState.value = getMetadataRole(currentUser);
    organizationIdState.value = getMetadataOrganizationId(currentUser);
    if (!activeOrganizationIdState.value) {
      activeOrganizationIdState.value = organizationIdState.value;
    }
  };

  const resetContext = (options: { preserveUser?: boolean } = {}) => {
    const preserveUser = options.preserveUser === true;
    if (!preserveUser) {
      user.value = null;
    }

    profile.value = null;
    profileFetchedForUserId.value = null;
    profileFetchedAt.value = 0;
    profileLoading.value = false;
    roleState.value = null;
    organizationIdState.value = null;
    activeOrganizationIdState.value = null;
    activeOrganizationSlugState.value = null;
    selectedBranchId.value = null;
    permissionGrants.value = [];
    permissionsRevision.value += 1;
    accountStatus.value = DEFAULT_ACCOUNT_STATUS;
    paymentRequired.value = false;
  };

  const refreshPermissions = async () => {
    permissionGrants.value = [];
    permissionsRevision.value += 1;
    return permissionGrants.value;
  };

  const setPermissionGrants = (grants: PermissionGrant[]) => {
    permissionGrants.value = [...grants];
  };

  const setAccountStatusState = (next: {
    accountStatus: "pending" | "active" | "rejected" | "suspended";
    paymentRequired: boolean;
  }) => {
    accountStatus.value = next.accountStatus;
    paymentRequired.value = next.paymentRequired;
  };

  const setActiveOrganization = (payload: {
    organizationId?: string | null;
    organizationSlug?: string | null;
  }) => {
    activeOrganizationIdState.value = sanitizeNullableString(payload.organizationId);
    activeOrganizationSlugState.value = sanitizeNullableString(payload.organizationSlug);
  };

  const refreshProfile = async (options: { force?: boolean } = {}): Promise<Profile | null> => {
    const currentUser = user.value ?? await resolveUser();
    if (!currentUser) {
      resetContext();
      return null;
    }

    syncFromCurrentUser(currentUser);
    const forceRefresh = options.force === true;
    const cacheIsFresh =
      profileFetchedForUserId.value === currentUser.id
      && Date.now() - profileFetchedAt.value < PROFILE_CACHE_TTL_MS
      && profile.value
      && profile.value.id === currentUser.id;

    if (!forceRefresh && cacheIsFresh) {
      return profile.value;
    }

    if (!forceRefresh && profileLoading.value) {
      let attempts = 0;
      while (profileLoading.value && attempts < 40) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 25);
        });
        attempts += 1;
      }

      if (profile.value?.id === currentUser.id) {
        return profile.value;
      }
    }

    profileLoading.value = true;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      profile.value = data ?? null;
      profileFetchedForUserId.value = currentUser.id;
      profileFetchedAt.value = Date.now();

      roleState.value = data?.role ?? getMetadataRole(currentUser);
      organizationIdState.value = data?.organization_id ?? getMetadataOrganizationId(currentUser);

      if (!activeOrganizationIdState.value && organizationIdState.value) {
        activeOrganizationIdState.value = organizationIdState.value;
      }

      return profile.value;
    } catch {
      profile.value = null;
      profileFetchedForUserId.value = null;
      profileFetchedAt.value = 0;
      roleState.value = getMetadataRole(currentUser);
      organizationIdState.value = getMetadataOrganizationId(currentUser);
      return null;
    } finally {
      profileLoading.value = false;
    }
  };

  const ensureContext = async (
    options: EnsureUserContextOptions = {},
  ): Promise<{ user: User | null; profile: Profile | null }> => {
    const currentUser = await resolveUser({ force: options.forceUserValidation === true });
    if (!currentUser) {
      resetContext();
      return { user: null, profile: null };
    }

    syncFromCurrentUser(currentUser);

    if (options.requireProfile === true) {
      const resolvedProfile = await refreshProfile({ force: options.forceProfileRefresh === true });
      return { user: currentUser, profile: resolvedProfile };
    }

    return {
      user: currentUser,
      profile: profile.value?.id === currentUser.id ? profile.value : null,
    };
  };

  if (!contextWatcherInitialized.value) {
    contextWatcherInitialized.value = true;

    watch(
      () => session.value?.user ?? null,
      (nextUser) => {
        syncFromCurrentUser(nextUser);
      },
      { immediate: true },
    );

    watch(
      () => [user.value?.id ?? null, organizationIdState.value] as const,
      ([nextUserId, nextOrganizationId]) => {
        const userChanged = lastContextUserId.value !== nextUserId;
        const organizationChanged =
          lastContextOrganizationId.value !== nextOrganizationId
          && lastContextOrganizationId.value !== null;

        if (userChanged) {
          selectedBranchId.value = null;
          permissionGrants.value = [];
          permissionsRevision.value += 1;
          accountStatus.value = DEFAULT_ACCOUNT_STATUS;
          paymentRequired.value = false;
        }

        if (organizationChanged) {
          selectedBranchId.value = null;
          permissionGrants.value = [];
          permissionsRevision.value += 1;
          accountStatus.value = DEFAULT_ACCOUNT_STATUS;
          paymentRequired.value = false;
          activeOrganizationIdState.value = nextOrganizationId;
          activeOrganizationSlugState.value = null;
        }

        lastContextUserId.value = nextUserId;
        lastContextOrganizationId.value = nextOrganizationId;
      },
      { immediate: true },
    );
  }

  return {
    user,
    profile,
    role,
    organizationId,
    activeOrganizationId,
    organizationContext,
    selectedBranchId,
    accountStatus,
    paymentRequired,
    permissionGrants,
    permissionsRevision,
    isAdmin,
    isManager,
    isEmployee,
    isClient,
    isBranchScopedRole,
    ensureContext,
    refreshProfile,
    refreshPermissions,
    resetContext,
    setActiveOrganization,
    setPermissionGrants,
    setAccountStatusState,
  };
};
