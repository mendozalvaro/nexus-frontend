import type { Database } from "@/types/database.types";
import type {
  PaymentPageState,
  PaymentStatusSummary,
  PaymentUploadPayload,
  ReceiptPreview,
} from "@/types/payment";
import {
  DEFAULT_BANK_DETAILS,
  ERROR_MESSAGES,
  MAX_RECEIPT_SIZE_BYTES,
  PAYMENT_SCHEMA,
  buildReceiptStoragePath,
  isReceiptMimeTypeAllowed,
  sanitizeFilename,
} from "@/utils/onboarding";

interface PaymentDraft {
  transactionRef: string;
  confirmTransfer: boolean;
  paymentMethod: string;
}

const createPaymentDraft = (): PaymentDraft => ({
  transactionRef: "",
  confirmTransfer: false,
  paymentMethod: "bank_transfer",
});

export const usePaymentValidation = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { saveOnboardingProgress } = useRegistration();
  const { sendPaymentReceivedEmail } = useNotifications();

  const draft = useState<PaymentDraft>(
    "onboarding:payment:draft",
    createPaymentDraft,
  );
  const loading = useState<boolean>("onboarding:payment:loading", () => false);
  const uploadProgress = useState<number>(
    "onboarding:payment:upload-progress",
    () => 0,
  );
  const error = useState<string | null>("onboarding:payment:error", () => null);

  const hydrateDraft = () => {
    if (!import.meta.client) {
      return;
    }

    try {
      const rawValue = localStorage.getItem(PAYMENT_STORAGE_KEY);
      draft.value = rawValue
        ? (JSON.parse(rawValue) as PaymentDraft)
        : createPaymentDraft();
    } catch {
      draft.value = createPaymentDraft();
      localStorage.removeItem(PAYMENT_STORAGE_KEY);
    }
  };

  const persistDraft = () => {
    if (!import.meta.client) {
      return;
    }

    localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(draft.value));
  };

  /**
   * Persiste el estado parcial del paso de pago para retomarlo despues.
   */
  const savePaymentProgress = async (
    organizationId: string,
    status: PaymentPageState = "upload",
  ) => {
    await saveOnboardingProgress({
      currentStep: "payment",
      organizationId,
      progressData: asJsonObject({
        paymentDraft: draft.value,
        paymentState: status,
      }),
    });
  };

  const resolvePageState = (
    summary: PaymentStatusSummary | null,
  ): PaymentPageState => {
    switch (summary?.status) {
      case "approved":
        return "approved";
      case "pending":
        return "pending";
      case "rejected":
        return "rejected";
      default:
        return "upload";
    }
  };

  /**
   * Valida y arma la previsualizacion del comprobante seleccionado.
   */
  const buildReceiptPreview = (file: File): ReceiptPreview => {
    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
    }

    if (!isReceiptMimeTypeAllowed(file.type)) {
      throw new Error(ERROR_MESSAGES.INVALID_FILE_TYPE);
    }

    return {
      name: file.name,
      size: file.size,
      type: file.type,
      objectUrl:
        file.type === "application/pdf" ? null : URL.createObjectURL(file),
      isPdf: file.type === "application/pdf",
    };
  };

  /**
   * Obtiene el ultimo estado de validacion de pago de la organizacion.
   */
  const getPaymentStatus = async (
    organizationId: string,
  ): Promise<PaymentStatusSummary> => {
    const { data, error: queryError } = await supabase
      .from("payment_validations")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }

    if (!data) {
      return {
        status: "missing",
        latestValidation: null,
      };
    }

    return {
      status: (data.status ?? "pending") as PaymentStatusSummary["status"],
      latestValidation: data,
    };
  };

  /**
   * Sube el comprobante y registra la validacion manual pendiente.
   */
  const uploadReceipt = async (payload: PaymentUploadPayload) => {
    loading.value = true;
    uploadProgress.value = 12;
    error.value = null;

    try {
      buildReceiptPreview(payload.file);

      const safeFilename = sanitizeFilename(payload.file.name);
      const storagePath = buildReceiptStoragePath(
        payload.userId,
        payload.organizationId,
        safeFilename,
      );

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, payload.file, {
          upsert: false,
          contentType: payload.file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploadProgress.value = 58;

      const validatedPayload = PAYMENT_SCHEMA.parse({
        paymentMethod: draft.value.paymentMethod,
        transactionRef: payload.transactionRef,
        confirmTransfer: payload.confirmTransfer,
      });

      const { data: validation, error: insertError } = await supabase
        .from("payment_validations")
        .insert({
          organization_id: payload.organizationId,
          user_id: payload.userId,
          amount: payload.amount,
          payment_method: validatedPayload.paymentMethod,
          transaction_ref: sanitizeNullableText(
            validatedPayload.transactionRef,
          ),
          receipt_storage_path: storagePath,
          receipt_filename: safeFilename,
          receipt_mime_type: payload.file.type,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      uploadProgress.value = 82;

      await saveOnboardingProgress({
        currentStep: "completed",
        organizationId: payload.organizationId,
        progressData: asJsonObject({
          paymentDraft: draft.value,
          latestValidationId: validation.id,
        }),
      });

      if (session.value?.user?.id) {
        await supabase.from("audit_logs").insert({
          action: "INSERT",
          table_name: "payment_validations",
          record_id: validation.id,
          user_id: session.value.user.id,
          context: asJsonObject({
            event: "PAYMENT_RECEIPT_SUBMITTED",
            organization_id: payload.organizationId,
            receipt_storage_path: storagePath,
            amount: payload.amount,
          }),
        });
      }

      uploadProgress.value = 96;

      await sendPaymentReceivedEmail(payload.organizationId, payload.userId);

      if (import.meta.client) {
        localStorage.removeItem(PAYMENT_STORAGE_KEY);
      }

      uploadProgress.value = 100;
      return validation;
    } catch (uploadReceiptError) {
      const message =
        uploadReceiptError instanceof Error
          ? uploadReceiptError.message
          : ERROR_MESSAGES.UPLOAD_FAILED;
      error.value = message;
      throw uploadReceiptError;
    } finally {
      loading.value = false;
      window.setTimeout(() => {
        uploadProgress.value = 0;
      }, 500);
    }
  };

  if (import.meta.client) {
    onMounted(hydrateDraft);
  }

  watch(draft, persistDraft, { deep: true });

  const bankDetails = computed(() => {
    const route = useRoute();
    const planParam = typeof route.query.plan === "string" ? route.query.plan : "emprende";
    const billingParam = typeof route.query.billing === "string" ? route.query.billing : "monthly";
    const validBillingModes = ["monthly", "annual"] as const;
    type BillingMode = (typeof validBillingModes)[number];
    const billingMode = validBillingModes.includes(billingParam as BillingMode)
      ? (billingParam as BillingMode)
      : "monthly";
    const plan = getPlanBySlug(planParam);
    const monthlyAmount = plan?.priceMonthly ?? DEFAULT_BANK_DETAILS.amountUsd;
    const amountUsd = billingMode === "annual"
      ? Math.round(monthlyAmount * 12 * 0.85)
      : monthlyAmount;

    return {
      bankName: DEFAULT_BANK_DETAILS.bankName,
      accountNumber: DEFAULT_BANK_DETAILS.accountNumber,
      accountHolder: DEFAULT_BANK_DETAILS.accountHolder,
      amountUsd,
      planName: plan?.name ?? DEFAULT_BANK_DETAILS.planName,
      qrPlaceholderUrl: DEFAULT_BANK_DETAILS.qrPlaceholderUrl,
      billingMode,
    };
  });

  return {
    bankDetails,
    draft,
    loading,
    uploadProgress,
    error,
    hydrateDraft,
    persistDraft,
    savePaymentProgress,
    resolvePageState,
    buildReceiptPreview,
    getPaymentStatus,
    uploadReceipt,
  };
};
