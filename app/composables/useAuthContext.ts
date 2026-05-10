import type { User } from "@supabase/supabase-js";

import type { AuthBootstrapState, Profile } from "@/types/auth";

export interface EnsureAuthContextOptions {
  requireProfile?: boolean;
  forceUserValidation?: boolean;
  forceProfileRefresh?: boolean;
}

export interface AuthContextPayload {
  user: User | null;
  profile: Profile | null;
  bootstrapState: AuthBootstrapState;
}

let pendingAuthContextPromise: Promise<AuthContextPayload> | null = null;

export const useAuthContext = () => {
  const { profile, ensureContext, contextBootstrapState } = useUserContext();

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
      const { user: currentUser, profile: resolvedProfile } = await ensureContext({
        requireProfile,
        forceUserValidation,
        forceProfileRefresh,
      });
      if (!currentUser) {
        return {
          user: null,
          profile: null,
          bootstrapState: contextBootstrapState.value,
        };
      }

      if (!requireProfile) {
        return {
          user: currentUser,
          profile: resolvedProfile ?? (profile.value?.id === currentUser.id ? profile.value : null),
          bootstrapState: contextBootstrapState.value,
        };
      }

      return {
        user: currentUser,
        profile: resolvedProfile,
        bootstrapState: contextBootstrapState.value,
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
