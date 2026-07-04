import type { Database, Json } from "@/types/database.types";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
type ListRpcRow =
  Database["public"]["Functions"]["admin_list_payment_validations"]["Returns"][number];
type DetailRpcRow =
  Database["public"]["Functions"]["admin_get_payment_validation_detail"]["Returns"][number];

export type PaymentValidationStatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected";

export interface PaymentSystemFilters {
  search: string;
  status: PaymentValidationStatusFilter;
  dateFrom: string;
  dateTo: string;
}

export interface PaymentSystemStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgTime: string;
}

export interface PaymentValidationListRow {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string | null;
  transactionRef: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
  receiptFilename: string;
  receiptMimeType: string | null;
  receiptStoragePath: string;
}

export interface PaymentValidationDetail extends PaymentValidationListRow {
  organizationStatus: string | null;
  organizationAddress: string | null;
  subscriptionStatus: string | null;
  billingData: Json;
  receiptUrl: string | null;
  receiptSizeBytes: number | null;
}

interface ReviewResult {
  decision: "approved" | "rejected";
  id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  user_email: string;
  user_full_name: string;
}

const createDefaultFilters = (): PaymentSystemFilters => ({
  search: "",
  status: "pending",
  dateFrom: "",
  dateTo: "",
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readString = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const normalizeStatus = (value: string | null): PaymentValidationListRow["status"] => {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
};

const mapListRow = (row: ListRpcRow): PaymentValidationListRow => ({
  id: row.id,
  organizationId: row.organization_id,
  organizationName: row.organization_name,
  organizationSlug: row.organization_slug,
  userId: row.user_id,
  userFullName: row.user_full_name,
  userEmail: row.user_email,
  amount: row.amount,
  paymentMethod: row.payment_method,
  transactionRef: row.transaction_ref,
  status: normalizeStatus(row.status),
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
  rejectionReason: row.rejection_reason,
  reviewedByName: row.reviewed_by_name,
  receiptFilename: row.receipt_filename,
  receiptMimeType: row.receipt_mime_type,
  receiptStoragePath: row.receipt_storage_path,
});

const mapDetailRow = (row: DetailRpcRow): PaymentValidationListRow => ({
  id: row.id,
  organizationId: row.organization_id,
  organizationName: row.organization_name,
  organizationSlug: row.organization_slug,
  userId: row.user_id,
  userFullName: row.user_full_name,
  userEmail: row.user_email,
  amount: row.amount,
  paymentMethod: row.payment_method,
  transactionRef: row.transaction_ref,
  status: normalizeStatus(row.status),
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
  rejectionReason: row.rejection_reason,
  reviewedByName: row.reviewed_by_name,
  receiptFilename: row.receipt_filename,
  receiptMimeType: row.receipt_mime_type,
  receiptStoragePath: row.receipt_storage_path,
});

const parseReviewResult = (value: Json): ReviewResult | null => {
  if (!isRecord(value)) {
    return null;
  }

  const decision = readString(value.decision);
  const id = readString(value.id);
  const organizationId = readString(value.organization_id);
  const organizationName = readString(value.organization_name);
  const organizationSlug = readString(value.organization_slug);
  const userEmail = readString(value.user_email);
  const userFullName = readString(value.user_full_name);

  if (
    (decision !== "approved" && decision !== "rejected")
    || !id
    || !organizationId
    || !organizationName
    || !organizationSlug
    || !userEmail
    || !userFullName
  ) {
    return null;
  }

  return {
    decision,
    id,
    organization_id: organizationId,
    organization_name: organizationName,
    organization_slug: organizationSlug,
    user_email: userEmail,
    user_full_name: userFullName,
  };
};

export const usePaymentSystem = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const runtimeConfig = useRuntimeConfig();
  const { sendAccountActivatedEmail, sendPaymentRejectedEmail } = useNotifications();

  const stats = useState<PaymentSystemStats>("system:payments:stats", () => ({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
    avgTime: "0 min",
  }));
  const validations = useState<PaymentValidationListRow[]>(
    "system:payments:rows",
    () => [],
  );
  const selectedValidation = useState<PaymentValidationDetail | null>(
    "system:payments:selected",
    () => null,
  );
  const systemUser = useState<SystemUserRow | null>(
    "system:payments:system-user",
    () => null,
  );
  const loading = useState<boolean>("system:payments:loading", () => false);
  const detailLoading = useState<boolean>("system:payments:detail-loading", () => false);
  const actionLoading = useState<boolean>("system:payments:action-loading", () => false);
  const error = useState<string | null>("system:payments:error", () => null);
  const feedback = useState<{
    color: "success" | "error";
    title: string;
    description: string;
  } | null>("system:payments:feedback", () => null);
  const totalValidations = useState<number>("system:payments:total", () => 0);
  const page = useState<number>("system:payments:page", () => 1);
  const perPage = useState<number>("system:payments:per-page", () => 20);

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(totalValidations.value / perPage.value)),
  );

  const getDefaultFilters = () => createDefaultFilters();

  const getSystemRequestHeaders = async () => {
    let token = session.value?.access_token;

    if (!token) {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }

      token = data.session?.access_token;
    }

    if (!token) {
      throw new Error("No se encontro una sesion valida para operaciones system.");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getReadableErrorMessage = (err: unknown, fallback: string) => {
    if (!err || typeof err !== "object") {
      return fallback;
    }

    const candidate = ((err as {
      data?: { message?: string; statusMessage?: string };
      statusMessage?: string;
      message?: string;
    }).data?.statusMessage)
      ?? (err as {
        data?: { message?: string; statusMessage?: string };
        statusMessage?: string;
        message?: string;
      }).data?.message
      ?? (err as { statusMessage?: string; message?: string }).statusMessage
      ?? (err as { statusMessage?: string; message?: string }).message;

    if (!candidate) {
      return fallback;
    }

    return candidate.replace(/^\[[A-Z_]+\]\s+"[^"]+":\s*/u, "").trim();
  };

  const resolveSystemUser = async (): Promise<SystemUserRow | null> => {
    const currentUserId = session.value?.user?.id;
    if (!currentUserId) {
      systemUser.value = null;
      return null;
    }

    const { data, error: queryError } = await supabase
      .from("system_users")
      .select("*")
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }

    systemUser.value = data;
    return data;
  };

  const loadStats = async () => {
    const response = await $fetch<{ stats: PaymentSystemStats }>("/api/system/payment-validations/stats", {
      headers: await getSystemRequestHeaders(),
    });
    stats.value = response.stats;
  };

  const loadValidations = async (filters: PaymentSystemFilters) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        rows: ListRpcRow[];
        total: number;
      }>("/api/system/payment-validations", {
        headers: await getSystemRequestHeaders(),
        query: {
          search: filters.search || undefined,
          status: filters.status || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          page: page.value,
          perPage: perPage.value,
        },
      });

      validations.value = Array.isArray(response.rows) ? response.rows.map(mapListRow) : [];
      totalValidations.value = Number(response.total ?? 0);
    } catch (loadError) {
      error.value = getReadableErrorMessage(loadError, "No pudimos cargar las validaciones de pago.");
      validations.value = [];
      totalValidations.value = 0;
    } finally {
      loading.value = false;
    }
  };

  const refreshData = async (filters: PaymentSystemFilters) => {
    feedback.value = null;
    await Promise.all([loadStats(), loadValidations(filters)]);
  };

  const openValidationDetail = async (validationId: string) => {
    detailLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        row: (DetailRpcRow & {
          receipt_url: string | null;
          receipt_size_bytes: number | null;
        }) | null;
      }>(`/api/system/payment-validations/${validationId}`, {
        headers: await getSystemRequestHeaders(),
      });

      const row = response.row;
      if (!row) {
        throw new Error("No encontramos la validacion seleccionada.");
      }

      selectedValidation.value = {
        ...mapDetailRow(row),
        organizationStatus: row.organization_status,
        organizationAddress: row.organization_address,
        subscriptionStatus: row.subscription_status,
        billingData: row.billing_data,
        receiptUrl: row.receipt_url,
        receiptSizeBytes: row.receipt_size_bytes,
      };
    } catch (detailLoadError) {
      error.value = getReadableErrorMessage(detailLoadError, "No pudimos cargar el detalle de la validacion.");
      selectedValidation.value = null;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeValidationDetail = () => {
    selectedValidation.value = null;
  };

  const notifyReview = async (result: ReviewResult) => {
    const baseUrl = import.meta.client
      ? window.location.origin
      : runtimeConfig.public?.siteUrl ?? "";
    const dashboardUrl = `${baseUrl}/dashboard`;

    if (result.decision === "approved") {
      await sendAccountActivatedEmail(
        result.organization_name,
        result.user_email,
        dashboardUrl,
      );
      return;
    }

    await sendPaymentRejectedEmail(
      result.organization_name,
      result.user_email,
      "Tu comprobante requiere una nueva revision.",
    );
  };

  const reviewValidation = async (
    input: {
      validationId: string;
      decision: "approved" | "rejected";
      reason?: string | null;
      filters: PaymentSystemFilters;
    },
  ) => {
    actionLoading.value = true;
    error.value = null;
    feedback.value = null;

    try {
      const response = await $fetch<{ result: Json }>(
        `/api/system/payment-validations/${input.validationId}/review`,
        {
          method: "POST",
          headers: await getSystemRequestHeaders(),
          body: {
            decision: input.decision,
            reason: input.reason ?? null,
          },
        },
      );

      const result = parseReviewResult(response.result);
      if (!result) {
        throw new Error("No pudimos procesar la respuesta de la revision.");
      }

      await notifyReview(result);
      await refreshData(input.filters);

      if (selectedValidation.value?.id === input.validationId) {
        await openValidationDetail(input.validationId);
      }

      feedback.value = {
        color: "success",
        title: input.decision === "approved" ? "Pago aprobado" : "Pago rechazado",
        description: input.decision === "approved"
          ? "La organizacion ya puede activarse con acceso completo."
          : "El usuario tendra que cargar un nuevo comprobante para continuar.",
      };
    } catch (reviewValidationError) {
      feedback.value = {
        color: "error",
        title: "No pudimos completar la revision",
        description: getReadableErrorMessage(
          reviewValidationError,
          "Ocurrio un error inesperado al revisar el pago.",
        ),
      };
      throw reviewValidationError;
    } finally {
      actionLoading.value = false;
    }
  };

  return {
    stats,
    validations,
    selectedValidation,
    systemUser,
    loading,
    detailLoading,
    actionLoading,
    error,
    feedback,
    page,
    perPage,
    totalValidations,
    pageCount,
    getDefaultFilters,
    resolveSystemUser,
    loadStats,
    loadValidations,
    refreshData,
    openValidationDetail,
    closeValidationDetail,
    reviewValidation,
  };
};
