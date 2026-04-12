import type { User } from "@supabase/supabase-js";

import type { Profile } from "@/types/auth";

export interface EnsureAuthContextOptions {
  requireProfile?: boolean;
  forceUserValidation?: boolean;
  forceProfileRefresh?: boolean;
}

export interface AuthContextPayload {
  user: User | null;
  profile: Profile | null;
}

let pendingAuthContextPromise: Promise<AuthContextPayload> | null = null;

export const useAuthContext = () => {
  const { resolveUser } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();

  const ensureAuthContext = async (
    options: EnsureAuthContextOptions = {},
  ): Promise<AuthContextPayload> => {
    const requireProfile = options.requireProfile === true;
    const forceUserValidation = options.forceUserValidation === true;
    const forceProfileRefresh = options.forceProfileRefresh === true;
    const canReusePending = !forceUserValidation && !forceProfileRefresh;

    if (canReusePending && pendingAuthContextPromise) {
      const pendingResult = await pendingAuthContextPromise;
      if (!requireProfile || pendingResult.profile) {
        return pendingResult;
      }
    }

    const loader = (async (): Promise<AuthContextPayload> => {
      const currentUser = await resolveUser({ force: forceUserValidation });
      if (!currentUser) {
        return {
          user: null,
          profile: null,
        };
      }

      if (!requireProfile) {
        return {
          user: currentUser,
          profile: profile.value?.id === currentUser.id ? profile.value : null,
        };
      }

      if (
        !forceProfileRefresh &&
        profile.value &&
        profile.value.id === currentUser.id
      ) {
        return {
          user: currentUser,
          profile: profile.value,
        };
      }

      const resolvedProfile = await fetchProfile({ force: forceProfileRefresh });
      return {
        user: currentUser,
        profile: resolvedProfile,
      };
    })();

    if (canReusePending) {
      pendingAuthContextPromise = loader;
    }

    try {
      return await loader;
    } finally {
      if (pendingAuthContextPromise === loader) {
        pendingAuthContextPromise = null;
      }
    }
  };

  return {
    ensureAuthContext,
  };
};
