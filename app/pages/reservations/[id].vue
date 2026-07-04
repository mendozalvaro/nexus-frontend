<script setup lang="ts">
import type { POSReceipt } from "@/composables/usePOS";
import type { ReservationDetail, ReservationStayActionPayload } from "@/composables/useReservations";
import ReservationDetailView from "@/components/reservations/views/ReservationDetailView.vue";
import ReservationStayActionModal from "@/components/reservations/modals/ReservationStayActionModal.vue";
import ReservationCancelModal from "@/components/reservations/modals/ReservationCancelModal.vue";
import ReservationPaymentModal from "@/components/reservations/modals/ReservationPaymentModal.vue";
import ReceiptViewer from "@/components/pos/modals/ReceiptViewer.vue";

type StayActionMode = "check_out" | "extend_stay" | "define_check_out" | "mark_open_ended";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "reservations.view",
  roles: ["admin", "manager", "employee"],
  moduleKey: "reservations",
});

const route = useRoute();
const reservationId = route.params.id as string;

const { loadReservationDetail, stayAction, cancelReservation, registerPayment } = useReservations();

const detail = ref<ReservationDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const cancelModalOpen = ref(false);
const paymentModalOpen = ref(false);
const receiptOpen = ref(false);
const receiptData = ref<POSReceipt | null>(null);
const stayActionModalOpen = ref(false);
const stayActionMode = ref<StayActionMode | null>(null);
const cancelReason = ref("");
const paymentForm = reactive({
  amount: 0,
  paymentMethod: "cash",
  paymentType: "deposit",
  reference: "",
});
const mutationLoading = ref(false);

const clearOpenPaymentQuery = async () => {
  if (!route.query.openPayment) {
    return;
  }

  await navigateTo({
    query: {
      ...route.query,
      openPayment: undefined,
    },
  }, { replace: true });
};

const handlePaymentModalOpenChange = async (open: boolean) => {
  paymentModalOpen.value = open;
  if (!open) {
    await clearOpenPaymentQuery();
  }
};

const normalizeReceiptNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return Number(digits || Date.now().toString().slice(0, 14));
};

const normalizeReceiptPaymentMethod = (value: string): POSReceipt["paymentMethod"] => {
  if (value === "cash" || value === "card" || value === "transfer" || value === "digital_wallet") {
    return value;
  }
  return "transfer";
};

const buildReceiptFromPayment = (payment: ReservationDetail["payments"][number]): POSReceipt | null => {
  if (!detail.value) {
    return null;
  }

  const mainGuest = detail.value.rooms
    .flatMap((room) => room.guests)
    .find((guest) => guest.isMainGuest) ?? detail.value.rooms[0]?.guests[0];
  const roomNumbers = detail.value.rooms.map((room) => room.roomNumber).join(", ");
  const balanceAfterPayment = Math.max(0, detail.value.totalAmount - detail.value.paidAmount);

  return {
    transactionId: payment.id,
    invoiceNumber: normalizeReceiptNumber(payment.paidAt),
    createdAt: payment.paidAt,
    branchId: detail.value.branchId,
    branchName: detail.value.branchName || "Recepcion",
    employeeId: detail.value.id,
    employeeName: detail.value.source ?? "Recepcion",
    customer: {
      mode: "walk_in",
      customerId: null,
      guestCustomerId: null,
      fullName: mainGuest?.fullName ?? "Huesped",
      phone: mainGuest?.phone ?? null,
      email: mainGuest?.email ?? null,
    },
    paymentMethod: normalizeReceiptPaymentMethod(payment.paymentMethod),
    totalAmount: payment.amount,
    discountAmount: 0,
    taxAmount: 0,
    finalAmount: payment.amount,
    formatUsed: "half_letter",
    verificationUrl: `${window.location.origin}/reservations/${detail.value.id}`,
    items: [
      {
        id: payment.id,
        itemType: "service",
        quantity: 1,
        unitPrice: payment.amount,
        subtotal: payment.amount,
        title: `Pago de estadia Hab. ${roomNumbers}`,
        subtitle: `Reserva ${detail.value.id.slice(0, 8)} · ${payment.paymentType} · saldo despues Bs ${balanceAfterPayment.toFixed(2)}`,
        snapshotData: null,
      },
    ],
  };
};

const openLatestReceipt = () => {
  const latestPayment = detail.value?.payments[0];
  if (!latestPayment) {
    return;
  }
  const nextReceipt = buildReceiptFromPayment(latestPayment);
  if (!nextReceipt) {
    return;
  }
  receiptData.value = nextReceipt;
  receiptOpen.value = true;
};

const load = async () => {
  loading.value = true;
  try {
    detail.value = await loadReservationDetail(reservationId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudo cargar la reserva.";
  } finally {
    loading.value = false;
  }
};

const canRegisterStay = computed(() => Boolean(detail.value && detail.value.status === "checked_in"));
const canCancel = computed(() => Boolean(detail.value && ["pending", "pending_payment", "confirmed"].includes(detail.value.status)));
const balance = computed(() => (detail.value ? detail.value.totalAmount - detail.value.paidAmount : 0));
const openStayActionModal = () => {
  stayActionMode.value = null;
  stayActionModalOpen.value = true;
};

const handleStayAction = async (payload: ReservationStayActionPayload) => {
  mutationLoading.value = true;
  try {
    await stayAction(reservationId, payload);
    stayActionModalOpen.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Error al registrar la estadía.";
  } finally {
    mutationLoading.value = false;
  }
};

const handleCancel = async () => {
  if (!cancelReason.value.trim()) return;
  mutationLoading.value = true;
  try {
    await cancelReservation(reservationId, cancelReason.value);
    cancelModalOpen.value = false;
    cancelReason.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Error al cancelar.";
  } finally {
    mutationLoading.value = false;
  }
};

const handlePayment = async () => {
  if (paymentForm.amount <= 0) return;
  mutationLoading.value = true;
  try {
    const paymentSnapshot = {
      id: `payment-${Date.now()}`,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethod,
      paymentType: paymentForm.paymentType,
      reference: paymentForm.reference || null,
      notes: null,
      paidAt: new Date().toISOString(),
    };
    await registerPayment({
      reservationId,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethod,
      paymentType: paymentForm.paymentType,
      reference: paymentForm.reference || undefined,
    });
    paymentModalOpen.value = false;
    Object.assign(paymentForm, { amount: 0, paymentMethod: "cash", paymentType: "deposit", reference: "" });
    await load();
    const nextReceipt = buildReceiptFromPayment(detail.value?.payments[0] ?? paymentSnapshot);
    if (nextReceipt) {
      receiptData.value = nextReceipt;
      receiptOpen.value = true;
    }
    await clearOpenPaymentQuery();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Error al registrar pago.";
  } finally {
    mutationLoading.value = false;
  }
};

onMounted(load);

watch(
  [() => route.query.openPayment, () => detail.value],
  ([flag, currentDetail]) => {
    if (flag === "1" && currentDetail) {
      paymentModalOpen.value = true;
      void clearOpenPaymentQuery();
    }
  },
  { immediate: true },
);

watch(
  [() => route.query.openStay, () => detail.value],
  ([mode, currentDetail]) => {
    if (!currentDetail || typeof mode !== "string") {
      return;
    }

    const supportedModes = ["check_out", "extend_stay", "define_check_out", "mark_open_ended"];
    if (!supportedModes.includes(mode)) {
      return;
    }

    stayActionMode.value = mode as StayActionMode;
    stayActionModalOpen.value = true;
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-6">
    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-x" :title="error" />

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <ReservationDetailView
      v-if="detail && !loading"
      :detail="detail"
      :loading="loading"
      :mutation-loading="mutationLoading"
      :can-register-stay="canRegisterStay"
      :can-cancel="canCancel"
      :balance="balance"
      @open-stay-action="openStayActionModal"
      @open-cancel="cancelModalOpen = true"
      @open-payment="paymentModalOpen = true"
      @open-receipt="openLatestReceipt"
    />

    <ReservationStayActionModal
      v-if="detail"
      v-model:open="stayActionModalOpen"
      :loading="mutationLoading"
      :status="detail.status"
      :is-open-ended="detail.isOpenEnded"
      :current-check-out="detail.checkOut"
      :initial-mode="stayActionMode"
      @submit="handleStayAction"
    />

    <ReservationCancelModal
      v-model:open="cancelModalOpen"
      v-model:reason="cancelReason"
      :loading="mutationLoading"
      @submit="handleCancel"
    />

    <ReservationPaymentModal
      :open="paymentModalOpen"
      :loading="mutationLoading"
      :amount="paymentForm.amount"
      :payment-method="paymentForm.paymentMethod"
      :payment-type="paymentForm.paymentType"
      :reference="paymentForm.reference"
      :balance="balance"
      @update:open="handlePaymentModalOpenChange"
      @update:amount="(value: number) => paymentForm.amount = value"
      @update:payment-method="(value: string) => paymentForm.paymentMethod = value"
      @update:payment-type="(value: string) => paymentForm.paymentType = value"
      @update:reference="(value: string) => paymentForm.reference = value"
      @submit="handlePayment"
    />

    <UModal v-if="receiptData" v-model:open="receiptOpen" title="Recibo de pago" size="xl" @update:open="(open) => { if (!open) receiptData = null; }">
      <template #body>
        <ReceiptViewer :receipt="receiptData" @close="receiptOpen = false; receiptData = null" />
      </template>
    </UModal>
  </div>
</template>
