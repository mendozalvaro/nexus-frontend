import type { SubscriptionPlanSlug } from "@/types/subscription";

export interface BillingLedgerEntry {
  id: string;
  event_type: string;
  amount: number | null;
  currency: string;
  billing_mode: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  plan: { id: string; name: string; slug: string } | null;
}

export interface BillingHistoryResponse {
  entries: BillingLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChangePlanPayload {
  plan_slug: SubscriptionPlanSlug;
  billing_mode?: "monthly" | "quarterly" | "annual";
}

export interface CancelPayload {
  confirm: true;
  reason?: string;
}

export interface ChangePlanResult {
  subscription: {
    id: string;
    billing_mode: string | null;
    payment_method: string | null;
    status: string | null;
    current_period_end: string | null;
    updated_at: string | null;
  };
  plan: { slug: string; name: string };
  proration: { amount: number; description: string } | null;
}

export interface CancelResult {
  subscription: {
    id: string;
    billing_mode: string | null;
    payment_method: string | null;
    status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    updated_at: string | null;
  };
  message: string;
}

export const useBilling = () => {
  const { loadCapabilities } = useSubscription();
  const { refreshOrganization } = useGlobalOrganization();

  const history = useState<BillingLedgerEntry[]>("billing:history", () => []);
  const historyLoading = useState<boolean>("billing:history-loading", () => false);
  const historyTotal = useState<number>("billing:history-total", () => 0);
  const mutationLoading = useState<boolean>("billing:mutation-loading", () => false);
  const error = useState<string | null>("billing:error", () => null);

  const loadHistory = async (limit = 50, offset = 0) => {
    historyLoading.value = true;
    error.value = null;
    try {
      const res = await $fetch<BillingHistoryResponse>("/api/billing/history", {
        query: { limit, offset },
      });
      history.value = res.entries;
      historyTotal.value = res.total;
      return res;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cargar el historial.";
      throw e;
    } finally {
      historyLoading.value = false;
    }
  };

  const changePlan = async (payload: ChangePlanPayload): Promise<ChangePlanResult> => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const result = await $fetch<ChangePlanResult>("/api/subscription/change-plan", {
        method: "POST",
        body: payload,
      });
      await loadCapabilities(undefined, { force: true });
      await refreshOrganization();
      await loadHistory();
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cambiar el plan.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const cancelSubscription = async (payload: CancelPayload): Promise<CancelResult> => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const result = await $fetch<CancelResult>("/api/subscription/cancel", {
        method: "PATCH",
        body: payload,
      });
      await loadCapabilities(undefined, { force: true });
      await loadHistory();
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cancelar la suscripcion.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    history,
    historyLoading,
    historyTotal,
    mutationLoading,
    error,
    loadHistory,
    changePlan,
    cancelSubscription,
    clearError,
  };
};
