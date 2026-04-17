import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type {
  OnboardingProgressPayload,
  OnboardingProgressRow,
  PostAuthResolution,
  RegistrationDraft,
  RegistrationResult,
} from "@/types/registration";
import {
  ERROR_MESSAGES,
  ORGANIZATION_STORAGE_KEY,
  PAYMENT_STORAGE_KEY,
  REGISTRATION_SCHEMA,
  REGISTRATION_STORAGE_KEY,
  RESEND_STORAGE_KEY,
  asJsonObject,
  sanitizeEmail,
  sanitizeText,
} from "@/utils/onboarding";

const createRegistrationDraft = (): RegistrationDraft => ({
  fullName: "",
  email: "",
  password: "",
  acceptTerms: false,
  selectedPlan: "emprende",
  billingMode: "monthly",
});

const createResendState = () => ({
  lastSentAt: 0,
});

const ONBOARDING_PROGRESS_CACHE_TTL_MS = 30_000;
let pendingOnboardingProgressPromise: Promise<OnboardingProgressRow | null> | null = null;

export const useRegistration = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { resolveUser } = useSessionAccess();
  const { fetchProfile } = useAuth();

  const registrationDraft = useState<RegistrationDraft>(
    "onboarding:registration:draft",
    createRegistrationDraft,
  );
  const resendState = useState<{ lastSentAt: number }>(
    "onboarding:resend:state",
    createResendState,
  );
  const progress = useState<OnboardingProgressRow | null>(
    "onboarding:progress",
    () => null,
  );
  const progressFetchedForUserId = useState<string | null>(
    "onboarding:progress:fetched-user-id",
    () => null,
  );
  const progressFetchedAt = useState<number>(
    "onboarding:progress:fetched-at",
    () => 0,
  );
  const loading = useState<boolean>(
    "onboarding:registration:loading",
    () => false,
  );
  const verifying = useState<boolean>(
    "onboarding:registration:verifying",
    () => false,
  );
  const error = useState<string | null>(
    "onboarding:registration:error",
    () => null,
  );

  const canResendIn = computed(() => {
    const remaining = resendState.value.lastSentAt + 60000 - Date.now();
    return Math.max(Math.ceil(remaining / 1000), 0);
  });

  const persistRegistrationDraft = () => {
    if (!import.meta.client) return;
    localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(registrationDraft.value));
  };

  const hydrateRegistrationDraft = () => {
    if (!import.meta.client) return;
    const rawValue = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!rawValue) return;
    try {
      const parsed = JSON.parse(rawValue) as RegistrationDraft;
      registrationDraft.value = { ...createRegistrationDraft(), ...parsed };
    } catch {
      localStorage.removeItem(REGISTRATION_STORAGE_KEY);
    }
  };

  const clearLocalOnboardingDrafts = () => {
    if (!import.meta.client) return;
    localStorage.removeItem(REGISTRATION_STORAGE_KEY);
    localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    localStorage.removeItem(PAYMENT_STORAGE_KEY);
  };

  const hydrateResendState = () => {
    if (!import.meta.client) return;
    try {
      const rawValue = localStorage.getItem(RESEND_STORAGE_KEY);
      resendState.value = rawValue ? (JSON.parse(rawValue) as { lastSentAt: number }) : createResendState();
    } catch {
      resendState.value = createResendState();
      localStorage.removeItem(RESEND_STORAGE_KEY);
    }
  };

  const persistResendState = () => {
    if (!import.meta.client) return;
    localStorage.setItem(RESEND_STORAGE_KEY, JSON.stringify(resendState.value));
  };

  const saveOnboardingProgress = async (
    payload: OnboardingProgressPayload,
  ): Promise<OnboardingProgressRow | null> => {
    const user = await resolveUser();
    if (!user) return null;

    const { data, error: upsertError } = await supabase
      .from("onboarding_progress")
      .upsert(
        {
          user_id: user.id,
          organization_id: payload.organizationId ?? null,
          current_step: payload.currentStep,
          progress_data: payload.progressData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (upsertError) {
      console.error("[ONBOARDING_PROGRESS_SAVE_ERROR]", upsertError.message);
      return null;
    }

    progress.value = data;
    return data;
  };

  const loadOnboardingProgress = async (options: { force?: boolean } = {}): Promise<OnboardingProgressRow | null> => {
    const user = await resolveUser();
    if (!user) {
      progress.value = null;
      progressFetchedForUserId.value = null;
      progressFetchedAt.value = 0;
      return null;
    }

    const forceRefresh = options.force === true;
    const cacheIsFresh =
      progressFetchedForUserId.value === user.id &&
      Date.now() - progressFetchedAt.value < ONBOARDING_PROGRESS_CACHE_TTL_MS;

    if (!forceRefresh && cacheIsFresh) return progress.value;
    if (!forceRefresh && pendingOnboardingProgressPromise) return await pendingOnboardingProgressPromise;

    const loader = (async (): Promise<OnboardingProgressRow | null> => {
      const { data, error: loadError } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (loadError) {
        console.error("[ONBOARDING_PROGRESS_LOAD_ERROR]", loadError.message);
        progress.value = null;
        progressFetchedForUserId.value = null;
        progressFetchedAt.value = 0;
        return null;
      }

      progress.value = data;
      progressFetchedForUserId.value = user.id;
      progressFetchedAt.value = Date.now();
      return data;
    })();

    if (!forceRefresh) pendingOnboardingProgressPromise = loader;

    try {
      return await loader;
    } finally {
      if (pendingOnboardingProgressPromise === loader) pendingOnboardingProgressPromise = null;
    }
  };

  const registerUser = async (draft: RegistrationDraft): Promise<RegistrationResult> => {
    loading.value = true;
    error.value = null;

    try {
      const parsed = REGISTRATION_SCHEMA.parse(draft);
      const sanitizedEmail = sanitizeEmail(parsed.email);
      const redirectTo = import.meta.client ? `${window.location.origin}/auth/callback` : undefined;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: parsed.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: sanitizeText(parsed.fullName),
            onboarding_step: "verification",
          },
        },
      });

      if (signUpError) {
        const normalized = signUpError.message.toLowerCase();
        if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
          throw new Error(ERROR_MESSAGES.EMAIL_EXISTS);
        }
        if (normalized.includes("rate limit") || normalized.includes("exceeded")) {
          throw new Error(ERROR_MESSAGES.EMAIL_RATE_LIMIT);
        }
        if (normalized.includes("invalid") && normalized.includes("email")) {
          throw new Error(ERROR_MESSAGES.EMAIL_INVALID);
        }
        throw signUpError;
      }

      registrationDraft.value = {
        ...parsed,
        email: sanitizedEmail,
      };
      persistRegistrationDraft();

      if (data.user) {
        await saveOnboardingProgress({
          currentStep: "verification",
          progressData: asJsonObject({
            registration: {
              email: sanitizedEmail,
              fullName: sanitizeText(parsed.fullName),
            },
          }),
        });
      }

      return {
        user: data.user,
        requiresEmailVerification: !data.user?.email_confirmed_at,
        email: sanitizedEmail,
      };
    } catch (registrationError) {
      const message = registrationError instanceof Error ? registrationError.message : ERROR_MESSAGES.GENERIC_AUTH;
      error.value = message;
      throw registrationError;
    } finally {
      loading.value = false;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    if (canResendIn.value > 0) return;
    const sanitizedEmail = sanitizeEmail(email);
    const redirectTo = import.meta.client ? `${window.location.origin}/auth/callback` : undefined;

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: sanitizedEmail,
      options: { emailRedirectTo: redirectTo },
    });

    if (resendError) throw resendError;
    resendState.value = { lastSentAt: Date.now() };
    persistResendState();
  };

  const refreshVerificationStatus = async (): Promise<User | null> => {
    verifying.value = true;
    try {
      const { data } = await supabase.auth.getUser();
      return data.user;
    } finally {
      verifying.value = false;
    }
  };

  const resolvePostAuthDestination = async (): Promise<PostAuthResolution> => {
    const user = await resolveUser();
    if (!user) return { destination: "/auth/login", reason: "login" };
    if (!user.email_confirmed_at) return { destination: `/auth/verify-email?email=${encodeURIComponent(user.email ?? registrationDraft.value.email)}`, reason: "verify" };

    const profile = await fetchProfile();
    const { data: isSystem } = await supabase.rpc("is_system_user");
    if (isSystem) return { destination: "/system", reason: "active" };

    if (!profile?.organization_id) return { destination: "/onboarding/organization", reason: "organization" };
    if (profile.role === "client") return { destination: "/client/dashboard", reason: "active" };

    const { data: organization } = await supabase
      .from("organizations")
      .select("id, status")
      .eq("id", profile.organization_id)
      .maybeSingle();

    if (organization?.status === "pending") {
      const { data: validation } = await supabase
        .from("payment_validations")
        .select("status, id")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profile.role === "admin" && (!validation || validation.status === "rejected")) {
        return { destination: "/onboarding/payment", reason: "payment" };
      }
      return { destination: "/dashboard?status=pending", reason: "pending" };
    }

    return { destination: "/dashboard", reason: "active" };
  };

  if (import.meta.client) {
    onMounted(() => {
      hydrateRegistrationDraft();
      hydrateResendState();
    });
  }

  watch(registrationDraft, persistRegistrationDraft, { deep: true });
  watch(
    () => session.value?.user?.id ?? null,
    async (userId) => {
      if (!userId) {
        progress.value = null;
        return;
      }
      await loadOnboardingProgress();
    },
    { immediate: true },
  );

  return {
    registrationDraft,
    progress,
    loading,
    verifying,
    error,
    canResendIn,
    hydrateRegistrationDraft,
    persistRegistrationDraft,
    clearLocalOnboardingDrafts,
    loadOnboardingProgress,
    saveOnboardingProgress,
    registerUser,
    resendVerificationEmail,
    refreshVerificationStatus,
    resolvePostAuthDestination,
  };
};
