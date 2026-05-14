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
  PAYMENT_STORAGE_KEY,
  getPlanBillingAmount,
  isReceiptMimeTypeAllowed,
  sanitizeFilename,
  getPlanBySlug,
} from "@/utils/onboarding";
import { asJsonObject } from "@/utils/onboarding";

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
    if (!import.meta.client) return;

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
    if (!import.meta.client) return;

    localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(draft.value));
  };

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

  const getPaymentStatus = async (
    organizationId: string,
  ): Promise<PaymentStatusSummary> => {
    const data = await $fetch<PaymentStatusSummary>("/api/onboarding/payment-status", {
      query: { organizationId },
    });

    if (!data) {
      return { status: "missing", latestValidation: null };
    }

    return data;
  };

  const uploadReceipt = async (payload: PaymentUploadPayload) => {
    loading.value = true;
    uploadProgress.value = 12;
    error.value = null;

    try {
      buildReceiptPreview(payload.file);

      const safeFilename = sanitizeFilename(payload.file.name);

      uploadProgress.value = 58;

      const validatedPayload = PAYMENT_SCHEMA.parse({
        paymentMethod: draft.value.paymentMethod,
        transactionRef: payload.transactionRef,
        confirmTransfer: payload.confirmTransfer,
      });

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(payload.file);
      });

      uploadProgress.value = 70;

      const result = await $fetch<{ validation: unknown }>("/api/onboarding/receipt", {
        method: "POST",
        body: {
          organizationId: payload.organizationId,
          amount: payload.amount,
          paymentMethod: validatedPayload.paymentMethod,
          transactionRef: validatedPayload.transactionRef,
          file: {
            dataBase64: base64,
            name: safeFilename,
            type: payload.file.type,
          },
        },
      });

      uploadProgress.value = 82;

      await saveOnboardingProgress({
        currentStep: "completed",
        organizationId: payload.organizationId,
        progressData: asJsonObject({
          paymentDraft: draft.value,
        }),
      });

      uploadProgress.value = 96;

      await sendPaymentReceivedEmail(payload.organizationId, payload.userId);

      if (import.meta.client) {
        localStorage.removeItem(PAYMENT_STORAGE_KEY);
      }

      uploadProgress.value = 100;
      return result.validation;
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
    const validBillingModes = ["monthly", "quarterly", "annual"] as const;
    type BillingMode = (typeof validBillingModes)[number];
    const billingMode = validBillingModes.includes(billingParam as BillingMode)
      ? (billingParam as BillingMode)
      : "monthly";
    const plan = getPlanBySlug(planParam);
    const amountUsd = getPlanBillingAmount(planParam, billingMode);

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
