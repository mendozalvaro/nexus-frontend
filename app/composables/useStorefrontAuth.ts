import type { Database } from "@/types/database.types";

export const useStorefrontAuth = () => {
  const supabase = useSupabaseClient<Database>();
  const { signIn, signInWithProvider } = useAuth();
  const { resolveAccessToken } = useSessionAccess();
  const storefrontAccessToken = useState<string | null>("storefront:access-token", () => null);

  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const successMessage = ref<string | null>(null);

  const readLocalSessionAccessToken = () => {
    if (!import.meta.client) {
      return null;
    }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.includes("auth-token")) {
        continue;
      }

      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }

      try {
        const parsed = JSON.parse(rawValue) as
          | { access_token?: unknown; currentSession?: { access_token?: unknown } | null }
          | Array<{ access_token?: unknown }>
          | null;

        const token = Array.isArray(parsed)
          ? parsed[0]?.access_token
          : parsed?.access_token ?? parsed?.currentSession?.access_token;

        if (typeof token === "string" && token.length > 0) {
          return token;
        }
      } catch {
        continue;
      }
    }

    return null;
  };

  const resolveStorefrontAccessToken = async () => {
    const sessionToken = await resolveAccessToken();
    if (sessionToken) {
      return sessionToken;
    }

    return storefrontAccessToken.value ?? readLocalSessionAccessToken();
  };

  const signInWithEmail = async (email: string, password: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const { data, error: signInError } = await signIn(email.trim().toLowerCase(), password, {
        resolveProfile: false,
      });

      if (signInError) throw signInError;
      storefrontAccessToken.value = data?.access_token ?? null;

      return { success: true as const, session: data };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Credenciales invalidas";
      error.value = message;
      storefrontAccessToken.value = null;
      return { success: false as const, error: message };
    } finally {
      isLoading.value = false;
    }
  };

  const signInWithStorefrontProvider = async (provider: "google", slug: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const { error: oauthError } = await signInWithProvider(provider, {
        audience: "client",
        redirect: `/${slug}`,
        slug,
      });

      if (oauthError) throw oauthError;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al iniciar sesion";
      error.value = message;
      isLoading.value = false;
    }
  };

  const registerClient = async (fullName: string, email: string, password: string, slug: string) => {
    isLoading.value = true;
    error.value = null;
    successMessage.value = null;

    try {
      const emailRedirectTo = import.meta.client
        ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(`/${slug}`)}`
        : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName.trim(),
            role: "client",
          },
        },
      });

      if (signUpError) throw signUpError;

      successMessage.value = "Cuenta creada. Revisa tu correo para confirmar.";
      return { success: true as const, user: data.user };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al registrarse";
      error.value = message;
      return { success: false as const, error: message };
    } finally {
      isLoading.value = false;
    }
  };

  return {
    signInWithEmail,
    signInWithProvider: signInWithStorefrontProvider,
    registerClient,
    resolveStorefrontAccessToken,
    successMessage: readonly(successMessage),
    isLoading: readonly(isLoading),
    error: readonly(error),
  };
};
