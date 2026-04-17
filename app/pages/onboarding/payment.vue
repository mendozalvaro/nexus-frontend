<script setup lang="ts">
import type {
  PaymentPageState,
  PaymentValidationInfo,
  ReceiptPreview,
} from "@/types/payment";

import AuthLayout from "../../components/auth/AuthLayout.vue";
import PaymentInstructions from "../../components/onboarding/PaymentInstructions.vue";
import ProgressStepper from "../../components/onboarding/ProgressStepper.vue";
import ReceiptUpload from "../../components/onboarding/ReceiptUpload.vue";

definePageMeta({
  layout: false,
  title: "Pago manual",
});

const { profile, fetchProfile } = useAuth();
const { resolveUser } = useSessionAccess();
const session = useSupabaseSession();
const {
  bankDetails,
  draft,
  loading,
  uploadProgress,
  error,
  buildReceiptPreview,
  getPaymentStatus,
  uploadReceipt,
  savePaymentProgress,
  resolvePageState,
} = usePaymentValidation();
const { resolvePostAuthDestination } = useRegistration();
const supabase = useSupabaseClient();

const preview = ref<ReceiptPreview | null>(null);
const latestStatus = ref<Awaited<ReturnType<typeof getPaymentStatus>> | null>(null);
const organizationSlug = ref("mi-organizacion");
const pageState = ref<PaymentPageState>("upload");
const validationInfo = ref<PaymentValidationInfo | null>(null);
const approvedRedirectSeconds = ref(3);

let redirectTimer: ReturnType<typeof setTimeout> | null = null;

const formattedSubmittedAt = computed(() =>
  validationInfo.value?.submittedAt
    ? new Date(validationInfo.value.submittedAt).toLocaleString("es-BO")
    : null,
);

const formattedReviewedAt = computed(() =>
  validationInfo.value?.reviewedAt
    ? new Date(validationInfo.value.reviewedAt).toLocaleString("es-BO")
    : null,
);

const setPreviewFile = (file: File | null) => {
  if (preview.value?.objectUrl) {
    URL.revokeObjectURL(preview.value.objectUrl);
  }

  preview.value = null;

  if (!file) {
    return;
  }

  const nextPreview = buildReceiptPreview(file);
  (nextPreview as ReceiptPreview & { file?: File }).file = file;
  preview.value = nextPreview;
};

const syncValidationInfo = (
  summary: Awaited<ReturnType<typeof getPaymentStatus>> | null,
) => {
  const latestValidation = summary?.latestValidation;
  validationInfo.value = latestValidation
    ? {
      submittedAt: latestValidation.created_at ?? undefined,
      reviewedAt: latestValidation.reviewed_at ?? undefined,
      rejectionReason: latestValidation.rejection_reason,
      reviewedBy: latestValidation.reviewed_by,
    }
    : null;
};

const scheduleApprovedRedirect = () => {
  if (redirectTimer) {
    clearInterval(redirectTimer);
  }

  approvedRedirectSeconds.value = 3;
  redirectTimer = setInterval(async () => {
    approvedRedirectSeconds.value -= 1;

    if (approvedRedirectSeconds.value <= 0) {
      clearInterval(redirectTimer as ReturnType<typeof setTimeout>);
      redirectTimer = null;
      await navigateTo("/dashboard", { replace: true });
    }
  }, 1000);
};

const updatePageState = (
  summary: Awaited<ReturnType<typeof getPaymentStatus>> | null,
) => {
  pageState.value = resolvePageState(summary);
  syncValidationInfo(summary);

  if (pageState.value === "approved") {
    scheduleApprovedRedirect();
    return;
  }

  if (redirectTimer) {
    clearInterval(redirectTimer);
    redirectTimer = null;
  }
};

const loadContext = async () => {
  const currentProfile = profile.value ?? await fetchProfile();
  if (!currentProfile?.organization_id) {
    await navigateTo("/onboarding/organization", { replace: true });
    return;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", currentProfile.organization_id)
    .maybeSingle();
  organizationSlug.value = organization?.slug ?? "mi-organizacion";
  latestStatus.value = await getPaymentStatus(currentProfile.organization_id);
  updatePageState(latestStatus.value);
};

const onFileSelected = (file: File) => {
  try {
    setPreviewFile(file);
  } catch (fileError) {
    error.value =
      fileError instanceof Error
        ? fileError.message
        : "No pudimos preparar el comprobante.";
  }
};

const clearFileSelection = () => {
  setPreviewFile(null);
};

const onSubmit = async () => {
  const currentProfile = profile.value ?? await fetchProfile();
  const user = await resolveUser();
  const selectedFile = (preview.value as ReceiptPreview & { file?: File } | null)?.file;

  if (!currentProfile?.organization_id || !user || !selectedFile) {
    return;
  }

  if (!draft.value.confirmTransfer) {
    error.value = "Debes confirmar que realizaste la transferencia para continuar.";
    return;
  }

  await uploadReceipt({
    organizationId: currentProfile.organization_id,
    userId: user.id,
    amount: bankDetails.value.amountUsd,
    file: selectedFile,
    transactionRef: draft.value.transactionRef,
    confirmTransfer: draft.value.confirmTransfer,
  });

  latestStatus.value = await getPaymentStatus(currentProfile.organization_id);
  updatePageState(latestStatus.value);
  await navigateTo("/onboarding/success", { replace: true });
};

if (import.meta.client) {
  onMounted(async () => {
    const resolution = await resolvePostAuthDestination();
    if (!["payment", "pending"].includes(resolution.reason)) {
      await navigateTo(resolution.destination, { replace: true });
      return;
    }

    await loadContext();
  });
}

watch(
  () => [draft.value.transactionRef, draft.value.confirmTransfer, pageState.value],
  async () => {
    const organizationId = profile.value?.organization_id;
    if (!organizationId || !session.value?.user) {
      return;
    }

    await savePaymentProgress(organizationId, pageState.value);
  },
  { deep: false },
);

onBeforeUnmount(() => {
  if (redirectTimer) {
    clearInterval(redirectTimer);
  }

  if (preview.value?.objectUrl) {
    URL.revokeObjectURL(preview.value.objectUrl);
  }
});
</script>

<template>
  <AuthLayout
    eyebrow="Pago"
    title="Completa el pago"
    description="Sube tu comprobante de transferencia para activar la cuenta."
    :show-sidebar="false"
  >
    <div class="space-y-5">
      <ProgressStepper current-step="payment" />

      <PaymentInstructions :organization-slug="organizationSlug" :amount-usd="bankDetails.amountUsd"
        :plan-name="bankDetails.planName" :billing-mode="bankDetails.billingMode" :bank-name="bankDetails.bankName"
        :account-number="bankDetails.accountNumber" :account-holder="bankDetails.accountHolder"
        :qr-placeholder-url="bankDetails.qrPlaceholderUrl" :payment-method="draft.paymentMethod" />

      <UAlert v-if="pageState === 'pending'" color="warning" variant="soft" icon="i-lucide-timer"
        title="Comprobante recibido - En validacion" :description="formattedSubmittedAt
          ? `Recibimos tu comprobante el ${formattedSubmittedAt}. Te avisaremos por email cuando la cuenta este activa.`
          : 'Recibimos tu comprobante y esta en revision manual.'" />

      <UAlert v-if="pageState === 'rejected'" color="error" variant="soft" icon="i-lucide-x-circle"
        title="Comprobante rechazado"
        :description="validationInfo?.rejectionReason ?? 'Sube un nuevo comprobante para continuar.'" />

      <UCard v-if="pageState === 'approved'"
        class="rounded-[1.75rem] border border-emerald-300/80 bg-emerald-50/80 dark:border-emerald-700 dark:bg-emerald-950/25">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <div
                class="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <UIcon name="i-lucide-badge-check" class="h-6 w-6" />
              </div>
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Pago
                  aprobado</p>
                <h2 class="text-xl font-semibold text-slate-950 dark:text-white">Tu cuenta ya puede activarse</h2>
              </div>
            </div>
            <p class="text-sm text-slate-700 dark:text-slate-300">
              {{ formattedReviewedAt ? `Aprobado el ${formattedReviewedAt}.` : "Tu comprobante fue aprobado correctamente."}}
              Redirigiendo al dashboard en {{ approvedRedirectSeconds }}s.
            </p>

            <UButton color="primary" size="lg" @click="navigateTo('/dashboard', { replace: true })">
              Ir al dashboard
            </UButton>
          </div>
        </div>
      </UCard>

      <ReceiptUpload v-else :loading="loading" :upload-progress="uploadProgress" :error="error" :preview="preview"
        :page-state="pageState" :transaction-ref="draft.transactionRef" :confirm-transfer="draft.confirmTransfer" :payment-method="draft.paymentMethod"
        @update:transaction-ref="draft.transactionRef = $event"
        @update:confirm-transfer="draft.confirmTransfer = $event" @update:payment-method="draft.paymentMethod = $event"
        @file-selected="onFileSelected"
        @clear-file="clearFileSelection" @submit="onSubmit" />
    </div>
  </AuthLayout>
</template>
