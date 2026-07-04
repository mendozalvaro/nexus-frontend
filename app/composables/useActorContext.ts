import type { ActorAccessState, ActorContextPayload, ActorType } from "@/types/auth";
import type { Database } from "@/types/database.types";

import { isStaffRole } from "@/utils/auth";

const SYSTEM_ACCESS_TTL_MS = 30_000;

const resolveAccessState = (
  user: ActorContextPayload["user"],
  profile: ActorContextPayload["profile"],
  bootstrapState: string,
): ActorAccessState => {
  if (!user) {
    return "unauthenticated";
  }

  if (!profile && bootstrapState === "profile_incomplete") {
    return "profile_incomplete";
  }

  return "authenticated";
};

const resolveBaseActorType = (
  profile: ActorContextPayload["profile"],
): Exclude<ActorType, "system"> => {
  if (!profile?.role) {
    return "guest";
  }

  if (profile.role === "client") {
    return "client";
  }

  return isStaffRole(profile.role) ? "staff" : "guest";
};

export const useActorContext = () => {
  const supabase = useSupabaseClient<Database>();
  const {
    user,
    profile,
    contextBootstrapState,
    ensureContext,
  } = useUserContext();

  const systemCacheKey = useState<string | null>("actor-context:system-cache-key", () => null);
  const systemRole = useState<"system" | "support" | null>("actor-context:system-role", () => null);
  const systemFetchedAt = useState<number>("actor-context:system-fetched-at", () => 0);
  const systemLoading = useState<boolean>("actor-context:system-loading", () => false);

  const hasSystemAccess = computed(() => systemRole.value === "system" || systemRole.value === "support");
  const baseActorType = computed<Exclude<ActorType, "system">>(() => resolveBaseActorType(profile.value));

  const resolveSystemAccess = async (currentUserId: string | null): Promise<boolean> => {
    if (!currentUserId) {
      systemCacheKey.value = null;
      systemRole.value = null;
      systemFetchedAt.value = 0;
      return false;
    }

    const cacheIsFresh =
      systemCacheKey.value === currentUserId
      && Date.now() - systemFetchedAt.value < SYSTEM_ACCESS_TTL_MS;

    if (cacheIsFresh) {
      return hasSystemAccess.value;
    }

    if (systemLoading.value) {
      let attempts = 0;
      while (systemLoading.value && attempts < 40) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 25);
        });
        attempts += 1;
      }

      const cacheBecameFresh =
        systemCacheKey.value === currentUserId
        && Date.now() - systemFetchedAt.value < SYSTEM_ACCESS_TTL_MS;
      if (cacheBecameFresh) {
        return hasSystemAccess.value;
      }
    }

    systemLoading.value = true;

    try {
      const { data, error } = await supabase
        .from("system_users")
        .select("user_id, role, is_active")
        .eq("user_id", currentUserId)
        .maybeSingle();

      const nextRole = !error && data?.is_active && (data.role === "system" || data.role === "support")
        ? data.role
        : null;

      systemCacheKey.value = currentUserId;
      systemRole.value = nextRole;
      systemFetchedAt.value = Date.now();
      return nextRole === "system" || nextRole === "support";
    } finally {
      systemLoading.value = false;
    }
  };

  const resolveActorContext = async (
    options: {
      preferSystem?: boolean;
      requireProfile?: boolean;
      forceProfileRefresh?: boolean;
      forceUserValidation?: boolean;
    } = {},
  ): Promise<ActorContextPayload> => {
    const resolved = await ensureContext({
      requireProfile: options.requireProfile,
      forceProfileRefresh: options.forceProfileRefresh,
      forceUserValidation: options.forceUserValidation,
    });

    const currentUser = resolved.user;
    const currentProfile = resolved.profile ?? profile.value;
    const systemAccess = await resolveSystemAccess(currentUser?.id ?? null);
    const actorType = options.preferSystem && systemAccess
      ? "system"
      : resolveBaseActorType(currentProfile);

    return {
      actorType,
      accessState: resolveAccessState(currentUser, currentProfile, contextBootstrapState.value),
      hasSystemAccess: systemAccess,
      systemRole: systemRole.value,
      user: currentUser,
      profile: currentProfile,
    };
  };

  watch(
    () => user.value?.id ?? null,
    (nextUserId) => {
      if (nextUserId === systemCacheKey.value) {
        return;
      }

      systemCacheKey.value = null;
      systemRole.value = null;
      systemFetchedAt.value = 0;
    },
  );

  return {
    baseActorType,
    hasSystemAccess,
    systemRole,
    resolveSystemAccess,
    resolveActorContext,
  };
};
