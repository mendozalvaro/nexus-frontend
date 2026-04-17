import type { Database } from "@/types/database.types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type SubscriptionRow =
  Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type PaymentValidationRow =
  Database["public"]["Tables"]["payment_validations"]["Row"];

export interface OnboardingSuccessState {
  organization: Pick<OrganizationRow, "id" | "name" | "country" | "status">;
  subscription: Pick<SubscriptionRow, "status" | "current_period_end"> | null;
  validation: Pick<
    PaymentValidationRow,
    "id" | "status" | "created_at" | "reviewed_at" | "rejection_reason"
  > | null;
  accountState: "pending" | "approved" | "rejected" | "payment_required";
}

const POLLING_INTERVAL_MS = 30000;

const toIsoDateLabel = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString("es-BO");
};

export const useOnboarding = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { fetchProfile } = useAuth();

  const state = useState<OnboardingSuccessState | null>(
    "onboarding:success:state",
    () => null,
  );
  const loading = useState<boolean>("onboarding:success:loading", () => false);
  const error = useState<string | null>("onboarding:success:error", () => null);
  const checkingStatus = useState<boolean>(
    "onboarding:success:checking-status",
    () => false,
  );
  const lastCheckedAt = useState<string | null>(
    "onboarding:success:last-checked-at",
    () => null,
  );

  let pollingTimer: number | null = null;

  const clearPolling = () => {
    if (pollingTimer) {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  const resolveAccountState = (
    organizationStatus: string | null,
    subscriptionStatus: string | null,
    validationStatus: string | null,
  ): OnboardingSuccessState["accountState"] => {
    if (organizationStatus === "active" || subscriptionStatus === "active") {
      return "approved";
    }

    if (validationStatus === "rejected") {
      return "rejected";
    }

    if (!validationStatus) {
      return "payment_required";
    }

    return "pending";
  };

  /**
   * Registra la visita a la pantalla final del onboarding.
   */
  const logSuccessPageView = async (
    organizationId: string,
    paymentValidationId?: string | null,
  ) => {
    if (!session.value?.user?.id) {
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "INSERT",
      table_name: "onboarding_success",
      record_id: organizationId,
      user_id: session.value.user.id,
      context: {
        event: "ONBOARDING_SUCCESS_VIEWED",
        organization_id: organizationId,
        payment_validation_id: paymentValidationId ?? null,
      },
    });
  };

  /**
   * Carga el estado consolidado del onboarding para la cuenta actual.
   */
  const loadSuccessState = async (
    options?: { logAccess?: boolean },
  ): Promise<OnboardingSuccessState | null> => {
    loading.value = true;
    error.value = null;

    try {
      const profile = await fetchProfile();
      if (!profile?.organization_id) {
        state.value = null;
        return null;
      }

      const [{ data: organization, error: organizationError }, {
        data: subscription,
        error: subscriptionError,
      }, { data: validation, error: validationError }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, country, status")
          .eq("id", profile.organization_id)
          .single(),
        supabase
          .from("organization_subscriptions")
          .select("status, current_period_end")
          .eq("organization_id", profile.organization_id)
          .maybeSingle(),
        supabase
          .from("payment_validations")
          .select("id, status, created_at, reviewed_at, rejection_reason")
          .eq("organization_id", profile.organization_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (organizationError) {
        throw organizationError;
      }

      if (subscriptionError) {
        throw subscriptionError;
      }

      if (validationError) {
        throw validationError;
      }

      const nextState: OnboardingSuccessState = {
        organization,
        subscription,
        validation,
        accountState: resolveAccountState(
          organization.status,
          subscription?.status ?? null,
          validation?.status ?? null,
        ),
      };

      state.value = nextState;
      lastCheckedAt.value = new Date().toISOString();

      if (options?.logAccess) {
        await logSuccessPageView(organization.id, validation?.id);
      }

      return nextState;
    } catch (loadError) {
      error.value =
        loadError instanceof Error
          ? loadError.message
          : "No pudimos cargar el estado de activacion.";
      state.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Reconsulta el estado de activacion y redirige si la cuenta ya esta activa.
   */
  const refreshActivationStatus = async (): Promise<OnboardingSuccessState | null> => {
    checkingStatus.value = true;

    try {
      const nextState = await loadSuccessState();
      if (nextState?.accountState === "approved") {
        await navigateTo("/dashboard", { replace: true });
      }

      if (nextState?.accountState === "payment_required") {
        await navigateTo("/onboarding/payment", { replace: true });
      }

      return nextState;
    } finally {
      checkingStatus.value = false;
    }
  };

  /**
   * Inicia el polling del estado de activacion cada 30 segundos.
   */
  const startActivationPolling = () => {
    if (!import.meta.client || pollingTimer) {
      return;
    }

    pollingTimer = window.setInterval(async () => {
      await refreshActivationStatus();
    }, POLLING_INTERVAL_MS);
  };

  const ensureSuccessAccess = async () => {
    const profile = await fetchProfile();
    if (!profile?.organization_id) {
      await navigateTo("/onboarding/organization", { replace: true });
      return false;
    }

    const [{ data: organization, error: organizationError }, {
      data: validation,
      error: validationError,
    }] = await Promise.all([
      supabase
        .from("organizations")
        .select("status")
        .eq("id", profile.organization_id)
        .maybeSingle(),
      supabase
        .from("payment_validations")
        .select("status")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (organizationError) {
      throw organizationError;
    }

    if (validationError) {
      throw validationError;
    }

    if (organization?.status === "active") {
      await navigateTo("/dashboard", { replace: true });
      return false;
    }

    if (!validation) {
      await navigateTo("/onboarding/payment", { replace: true });
      return false;
    }

    if (validation.status === "rejected") {
      await navigateTo("/onboarding/payment", { replace: true });
      return false;
    }

    return true;
  };

  const formattedLastCheckedAt = computed(() =>
    toIsoDateLabel(lastCheckedAt.value),
  );

  const formattedSubmittedAt = computed(() =>
    toIsoDateLabel(state.value?.validation?.created_at),
  );

  const formattedPeriodEnd = computed(() =>
    toIsoDateLabel(state.value?.subscription?.current_period_end),
  );

  if (import.meta.client) {
    onBeforeUnmount(() => {
      clearPolling();
    });
  }

  return {
    state,
    loading,
    error,
    checkingStatus,
    formattedLastCheckedAt,
    formattedSubmittedAt,
    formattedPeriodEnd,
    ensureSuccessAccess,
    loadSuccessState,
    refreshActivationStatus,
    startActivationPolling,
    clearPolling,
  };
};
