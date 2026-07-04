import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { AuthBootstrapState } from "@/types/auth";

const USER_VALIDATION_TTL_MS = 30_000;
let pendingUserPromise: Promise<User | null> | null = null;
let pendingAccessTokenPromise: Promise<string | null> | null = null;

/**
 * Resuelve el usuario autenticado tolerando el desfase entre SSR y la
 * restauracion de sesion del cliente de Supabase.
 */
export const useSessionAccess = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const supabaseUser = useSupabaseUser();
  const authenticatedUser = useState<User | null>(
    "session-access:authenticated-user",
    () => null,
  );
  const validatedAccessToken = useState<string | null>(
    "session-access:validated-token",
    () => null,
  );
  const validatedAt = useState<number>("session-access:validated-at", () => 0);
  const authBootstrapState = useState<AuthBootstrapState>("session-access:bootstrap-state", () => "idle");

  const normalizeResolvedUser = (user: User | null): User | null => {
    if (!user) {
      return null;
    }

    if (typeof user.id === "string" && user.id.length > 0) {
      return user;
    }

    const fallbackId = (user as { sub?: unknown }).sub;
    if (typeof fallbackId !== "string" || fallbackId.length === 0) {
      return user;
    }

    return {
      ...user,
      id: fallbackId,
    };
  };

  const resolveAccessToken = async (): Promise<string | null> => {
    const readSessionToken = async (
      options: { force?: boolean } = {},
    ): Promise<string | null> => {
      const force = options.force === true;
      const reactiveToken = session.value?.access_token ?? null;
      if (reactiveToken) {
        return reactiveToken;
      }

      const cachedTokenIsFresh =
        validatedAccessToken.value
        && Date.now() - validatedAt.value < USER_VALIDATION_TTL_MS;
      if (!force && cachedTokenIsFresh) {
        return validatedAccessToken.value;
      }

      if (!force && pendingAccessTokenPromise) {
        return await pendingAccessTokenPromise;
      }

      const loader = async () => {
        const reactiveToken = session.value?.access_token ?? null;
        if (reactiveToken) {
          return reactiveToken;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!sessionError && sessionData.session?.access_token) {
          return sessionData.session.access_token;
        }

        return null;
      };

      if (force) {
        return await loader();
      }

      pendingAccessTokenPromise = loader();
      try {
        return await pendingAccessTokenPromise;
      } finally {
        if (pendingAccessTokenPromise) {
          pendingAccessTokenPromise = null;
        }
      }
    };

    const immediateToken = await readSessionToken();
    if (immediateToken) {
      return immediateToken;
    }

    if (import.meta.client) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 150);
        });

        const delayedReactiveToken = session.value?.access_token ?? null;
        if (delayedReactiveToken) {
          return delayedReactiveToken;
        }
      }
    }

    return await readSessionToken({ force: true });
  };

  /**
   * Obtiene el usuario autenticado validandolo contra Supabase Auth.
   * Evita depender de `session.user`, que proviene del storage local.
   */
  const resolveUser = async (options: { force?: boolean } = {}): Promise<User | null> => {
    const forceValidation = options.force === true;
    const ssrResolvedUser = normalizeResolvedUser(supabaseUser.value as User | null);
    if (ssrResolvedUser && !session.value?.access_token) {
      authenticatedUser.value = ssrResolvedUser;
      authBootstrapState.value = "authenticated";
      return ssrResolvedUser;
    }

    const token = await resolveAccessToken();

    if (!token) {
      authenticatedUser.value = null;
      validatedAccessToken.value = null;
      validatedAt.value = 0;
      authBootstrapState.value = "unauthenticated";
      return null;
    }

    const currentSessionUser = session.value?.user ?? null;
    const cacheIsFresh =
      validatedAccessToken.value === token &&
      Date.now() - validatedAt.value < USER_VALIDATION_TTL_MS;

    if (!forceValidation && cacheIsFresh) {
      if (authenticatedUser.value && (!currentSessionUser || authenticatedUser.value.id === currentSessionUser.id)) {
        return authenticatedUser.value;
      }

      if (!authenticatedUser.value && currentSessionUser) {
        authenticatedUser.value = currentSessionUser;
        return currentSessionUser;
      }
    }

    if (!forceValidation && pendingUserPromise) {
      return await pendingUserPromise;
    }

    const loader = (async (): Promise<User | null> => {
      authBootstrapState.value = "resolving";
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData.user) {
        authenticatedUser.value = userData.user;
        validatedAccessToken.value = token;
        validatedAt.value = Date.now();
        authBootstrapState.value = "authenticated";
        return userData.user;
      }

      if (import.meta.dev && userError) {
        console.warn("[SESSION_ACCESS]", userError.message);
      }

      authenticatedUser.value = null;
      validatedAccessToken.value = null;
      validatedAt.value = 0;
      authBootstrapState.value = "unauthenticated";
      return null;
    })();

    if (!forceValidation) {
      pendingUserPromise = loader;
    }

    try {
      return await loader;
    } finally {
      if (pendingUserPromise === loader) {
        pendingUserPromise = null;
      }
    }
  };

  const waitForAuthenticatedUser = async (
    options: {
      attempts?: number;
      delayMs?: number;
      forceFirstValidation?: boolean;
    } = {},
  ): Promise<User | null> => {
    const attempts = Math.max(1, options.attempts ?? 10);
    const delayMs = Math.max(0, options.delayMs ?? 1000);
    const forceFirstValidation = options.forceFirstValidation !== false;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const currentUser = await resolveUser({
        force: forceFirstValidation && attempt === 0,
      });
      if (currentUser) {
        return currentUser;
      }

      if (attempt < attempts - 1 && import.meta.client) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }
    }

    return null;
  };

  return {
    session,
    authenticatedUser,
    authBootstrapState,
    resolveUser,
    resolveAccessToken,
    waitForAuthenticatedUser,
  };
};
