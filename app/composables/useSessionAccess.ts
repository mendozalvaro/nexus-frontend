import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const USER_VALIDATION_TTL_MS = 30_000;
let pendingUserPromise: Promise<User | null> | null = null;

/**
 * Resuelve el usuario autenticado tolerando el desfase entre SSR y la
 * restauracion de sesion del cliente de Supabase.
 */
export const useSessionAccess = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const authenticatedUser = useState<User | null>(
    "session-access:authenticated-user",
    () => null,
  );
  const validatedAccessToken = useState<string | null>(
    "session-access:validated-token",
    () => null,
  );
  const validatedAt = useState<number>("session-access:validated-at", () => 0);

  const resolveAccessToken = async (): Promise<string | null> => {
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

  /**
   * Obtiene el usuario autenticado validandolo contra Supabase Auth.
   * Evita depender de `session.user`, que proviene del storage local.
   */
  const resolveUser = async (options: { force?: boolean } = {}): Promise<User | null> => {
    const forceValidation = options.force === true;
    const token = await resolveAccessToken();

    if (!token) {
      authenticatedUser.value = null;
      validatedAccessToken.value = null;
      validatedAt.value = 0;
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData.user) {
        authenticatedUser.value = userData.user;
        validatedAccessToken.value = token;
        validatedAt.value = Date.now();
        return userData.user;
      }

      if (import.meta.dev && userError) {
        console.warn("[SESSION_ACCESS]", userError.message);
      }

      authenticatedUser.value = null;
      validatedAccessToken.value = null;
      validatedAt.value = 0;
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

  return {
    session,
    authenticatedUser,
    resolveUser,
    resolveAccessToken,
  };
};
