<script setup lang="ts">
import type { ReservationDetail } from "@/composables/useReservations";
import { getReservationStatusMeta } from "@/composables/useReservations";

const props = defineProps<{
  detail: ReservationDetail;
  loading: boolean;
  mutationLoading: boolean;
  canRegisterStay: boolean;
  canCancel: boolean;
  balance: number;
}>();

const emit = defineEmits<{
  openStayAction: [];
  openCancel: [];
  openPayment: [];
  openReceipt: [paymentId?: string];
}>();

const statusMeta = computed(() => getReservationStatusMeta(props.detail));
const hasExtension = computed(() => Boolean(props.detail.extendedFromCheckOut));

const SEX_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
  digital_wallet: "Billetera digital",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Pago parcial",
  balance: "Pago parcial",
  full: "Pago total",
};

const SOURCE_LABELS: Record<string, string> = {
  staff: "Personal",
  client: "Cliente",
  web: "Web",
};

const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString() : "-";
const formatMoney = (value: number) => `$${value.toFixed(2)}`;
const formatSex = (value: string | null) => value ? (SEX_LABELS[value] ?? value) : "-";
const formatPaymentMethod = (value: string) => PAYMENT_METHOD_LABELS[value] ?? value;
const formatPaymentType = (value: string) => PAYMENT_TYPE_LABELS[value] ?? value;

const mainGuest = computed(() =>
  props.detail.rooms.flatMap((room) => room.guests).find((guest) => guest.isMainGuest) ?? null,
);

const roomSummary = computed(() =>
  props.detail.rooms.map((room) => `Hab. ${room.roomNumber}`).join(", ") || "-",
);

const stayFacts = computed(() => [
  { label: "Codigo", value: props.detail.id.slice(0, 8).toUpperCase() },
  { label: "Ingreso esperado", value: props.detail.checkIn },
  { label: "Ingreso registrado", value: formatDateTime(props.detail.actualCheckInAt) },
  { label: "Salida esperada", value: props.detail.checkOut },
  { label: "Salida registrada", value: formatDateTime(props.detail.actualCheckOutAt) },
  { label: "Tiempo de estadia", value: `${props.detail.nights} noche(s)` },
  { label: "Huesped principal", value: mainGuest.value?.fullName ?? "-" },
  { label: "Habitacion", value: roomSummary.value },
  { label: "Creado por", value: props.detail.createdByName ?? (props.detail.source ? (SOURCE_LABELS[props.detail.source] ?? props.detail.source) : "-") },
]);

const paymentHistory = computed(() => {
  let runningPaid = 0;
  const ascendingPayments = [...props.detail.payments].sort((left, right) =>
    new Date(left.paidAt).getTime() - new Date(right.paidAt).getTime(),
  );

  return ascendingPayments.map((payment) => {
    runningPaid += payment.amount;
    return {
      ...payment,
      methodLabel: formatPaymentMethod(payment.paymentMethod),
      typeLabel: formatPaymentType(payment.paymentType),
      statusLabel: runningPaid >= props.detail.totalAmount ? "Completa la reserva" : "Saldo pendiente",
      receiptLabel: payment.receiptKind === "final" ? "Recibo final" : "Recibo parcial",
    };
  }).reverse();
});
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge :color="statusMeta.color" variant="soft" size="lg">
              {{ statusMeta.label }}
            </UBadge>
            <UBadge v-if="detail.isOpenEnded" color="warning" variant="soft">Indefinida</UBadge>
            <UBadge v-if="hasExtension" color="primary" variant="soft">Extendida</UBadge>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Detalle de la estadia</p>
            <h1 class="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
              Reserva {{ detail.id.slice(0, 8).toUpperCase() }}
            </h1>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton v-if="canRegisterStay" color="success" icon="i-lucide-bed-double" :loading="mutationLoading" @click="emit('openStayAction')">
            Gestionar estadia
          </UButton>
          <UButton v-if="balance > 0" color="primary" icon="i-lucide-credit-card" @click="emit('openPayment')">
            Registrar pago
          </UButton>
          <UButton v-if="detail.payments.length" color="neutral" variant="soft" icon="i-lucide-receipt" @click="emit('openReceipt')">
            Ver ultimo recibo
          </UButton>
          <UButton v-if="canCancel" color="neutral" variant="soft" icon="i-lucide-x-circle" @click="emit('openCancel')">
            Cancelar
          </UButton>
        </div>
      </div>

      <div class="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="fact in stayFacts" :key="fact.label">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{{ fact.label }}</p>
          <p class="mt-1 text-sm font-medium text-slate-950 dark:text-white">{{ fact.value }}</p>
        </div>
      </div>
    </section>

    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <UCard class="rounded-[1.25rem]">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">Pagos</h2>
              <p class="text-sm text-slate-500">Historial de pagos registrados.</p>
            </div>
            <div class="rounded-lg bg-slate-100 px-3 py-2 text-right dark:bg-slate-900">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Saldo pendiente</p>
              <p class="text-sm font-semibold" :class="balance > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'">
                {{ formatMoney(balance) }}
              </p>
            </div>
          </div>
        </template>

        <div v-if="!paymentHistory.length" class="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-800">
          Sin pagos registrados.
        </div>

        <div v-else class="space-y-2.5">
          <div
            v-for="payment in paymentHistory"
            :key="payment.id"
            class="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge color="primary" variant="soft">{{ payment.typeLabel }}</UBadge>
                  <UBadge :color="payment.statusLabel === 'Completa la reserva' ? 'success' : 'warning'" variant="soft">
                    {{ payment.statusLabel }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft">{{ payment.receiptLabel }}</UBadge>
                </div>
                <p class="text-sm font-medium text-slate-950 dark:text-white">{{ payment.methodLabel }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ new Date(payment.paidAt).toLocaleString() }}
                  <span v-if="payment.reference"> - Ref. {{ payment.reference }}</span>
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Usuario: {{ payment.createdByName ?? "Sin registro" }}
                  <span v-if="payment.receiptNumber"> - {{ payment.receiptNumber }}</span>
                </p>
              </div>
              <div class="text-right">
                <p class="text-base font-semibold text-slate-950 dark:text-white">{{ formatMoney(payment.amount) }}</p>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-receipt"
                  @click="emit('openReceipt', payment.id)"
                >
                  Ver recibo
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <UCard class="rounded-[1.25rem]">
        <template #header>
          <div>
            <h2 class="text-lg font-semibold">Huespedes</h2>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="room in detail.rooms"
            :key="room.id"
            class="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-2 dark:border-slate-800">
              <div>
                <h3 class="text-sm font-semibold text-slate-950 dark:text-white">Hab. {{ room.roomNumber }}</h3>
                <p class="text-sm text-slate-500">{{ room.roomTypeName || "Sin categoria" }}</p>
              </div>
              <p class="text-sm font-semibold text-slate-950 dark:text-white">{{ formatMoney(room.roomPrice) }}</p>
            </div>

            <div class="mt-3 space-y-2">
              <div
                v-for="guest in room.guests"
                :key="guest.id"
                class="rounded-lg border border-white/70 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/70"
              >
                <div class="grid gap-2 sm:grid-cols-[1.3fr_1.6fr_0.9fr_auto] sm:items-center">
                  <UBadge :color="guest.isMainGuest ? 'primary' : 'neutral'" variant="soft">
                    {{ guest.isMainGuest ? "Principal" : "Acompanante" }}
                  </UBadge>
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Documento</p>
                    <p class="text-sm text-slate-900 dark:text-white">
                      {{ guest.documentType || "-" }} {{ guest.documentNumber || "-" }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nombres</p>
                    <p class="text-sm font-medium text-slate-950 dark:text-white">{{ guest.fullName }}</p>
                  </div>
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sexo</p>
                    <p class="text-sm text-slate-900 dark:text-white">{{ formatSex(guest.sex) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </section>
  </div>
</template>
