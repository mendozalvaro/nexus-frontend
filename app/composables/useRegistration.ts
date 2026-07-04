import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type {
  OnboardingProgressPayload,
  OnboardingProgressRow,
  RegistrationDraft,
  RegistrationResult,
} from "@/types/registration";
import {
  ERROR_MESSAGES,
  REGISTRATION_SCHEMA,
  asJsonObject,
  sanitizeEmail,
  sanitizeText,
} from "@/utils/onboarding";
import {
  isValidUuid,
} from "@/utils/auth";
import {
  clearOnboardingDraftsStorage,
  loadRegistrationDraft,
  loadResendState,
  saveRegistrationDraft,
  saveResendState,
} from "@/utils/registration-storage";

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
  const { resolvePostAuthDestination } = usePostAuthResolution();

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
    saveRegistrationDraft(registrationDraft.value);
  };

  const hydrateRegistrationDraft = () => {
    registrationDraft.value = loadRegistrationDraft(createRegistrationDraft);
  };

  const clearLocalOnboardingDrafts = () => {
    clearOnboardingDraftsStorage();
  };

  const hydrateResendState = () => {
    resendState.value = loadResendState(createResendState);
  };

  const persistResendState = () => {
    saveResendState(resendState.value);
  };

  const saveOnboardingProgress = async (
    payload: OnboardingProgressPayload,
  ): Promise<OnboardingProgressRow | null> => {
    const user = await resolveUser();
    if (!user || !isValidUuid(user.id)) return null;

    try {
      const response = await $fetch<{ progress: OnboardingProgressRow | null }>(
        "/api/auth/onboarding-progress",
        {
          method: "POST",
          body: {
            organizationId: payload.organizationId ?? null,
            currentStep: payload.currentStep,
            progressData: payload.progressData,
          },
        },
      );

      progress.value = response.progress;
      return response.progress;
    } catch (upsertError) {
      const message = upsertError instanceof Error ? upsertError.message : "unknown_error";
      console.error("[ONBOARDING_PROGRESS_SAVE_ERROR]", message);
      return null;
    }
  };

  const loadOnboardingProgress = async (options: { force?: boolean } = {}): Promise<OnboardingProgressRow | null> => {
    const user = await resolveUser();
    if (!user || !isValidUuid(user.id)) {
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
      try {
        const response = await $fetch<{ progress: OnboardingProgressRow | null }>(
          "/api/auth/onboarding-progress",
        );

        progress.value = response.progress;
        progressFetchedForUserId.value = user.id;
        progressFetchedAt.value = Date.now();
        return response.progress;
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "unknown_error";
        console.error("[ONBOARDING_PROGRESS_LOAD_ERROR]", message);
        progress.value = null;
        progressFetchedForUserId.value = null;
        progressFetchedAt.value = 0;
        return null;
      }
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
      if (!isValidUuid(userId)) {
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
