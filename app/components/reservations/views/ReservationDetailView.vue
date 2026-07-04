<script setup lang="ts">
import { h } from "vue";
import type { ReservationDetail, PaymentDetail } from "@/composables/useReservations";
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
  openReceipt: [];
}>();

const statusMeta = computed(() => getReservationStatusMeta(props.detail));
const hasExtension = computed(() => Boolean(props.detail.extendedFromCheckOut));

const guestColumns = computed(() => [
  { accessorKey: "fullName", header: "Nombre" },
  {
    accessorKey: "isMainGuest",
    header: "Rol",
    cell: ({ row }: { row: { original: ReservationDetail["rooms"][number]["guests"][number] } }) =>
      h("span", row.original.isMainGuest ? "Principal" : "Acompañante"),
  },
  { accessorKey: "documentType", header: "Doc." },
  { accessorKey: "documentNumber", header: "Nro." },
  { accessorKey: "birthDate", header: "Nacimiento" },
  { accessorKey: "sex", header: "Sexo" },
  { accessorKey: "phone", header: "Telefono" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "nationality", header: "Nacionalidad" },
  { accessorKey: "maritalStatus", header: "E. civil" },
  { accessorKey: "address", header: "Procedencia" },
]);

const paymentColumns = computed(() => [
  {
    accessorKey: "amount",
    header: "Monto",
    cell: ({ row }: { row: { original: PaymentDetail } }) =>
      h("span", { class: "font-medium" }, `$${row.original.amount.toFixed(2)}`),
  },
  { accessorKey: "paymentMethod", header: "Metodo" },
  { accessorKey: "paymentType", header: "Tipo" },
  { accessorKey: "reference", header: "Referencia" },
  {
    accessorKey: "paidAt",
    header: "Fecha",
    cell: ({ row }: { row: { original: PaymentDetail } }) =>
      h("span", new Date(row.original.paidAt).toLocaleString()),
  },
]);
</script>

<template>
  <div>
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Estadia #{{ detail.id.slice(0, 8) }}</h1>
        <p class="mt-1 text-sm text-slate-500">Creada el {{ new Date(detail.createdAt).toLocaleDateString() }}</p>
      </div>
      <UBadge :color="statusMeta.color" variant="soft" size="lg">
        {{ statusMeta.label }}
      </UBadge>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <UButton v-if="canRegisterStay" color="success" icon="i-lucide-bed-double" :loading="mutationLoading" @click="emit('openStayAction')">
        Gestionar estadia
      </UButton>
      <UButton v-if="canCancel" color="neutral" variant="soft" icon="i-lucide-x-circle" @click="emit('openCancel')">
        Cancelar
      </UButton>
      <UButton v-if="balance > 0" color="primary" icon="i-lucide-credit-card" @click="emit('openPayment')">
        Registrar pago (saldo: ${{ balance.toFixed(2) }})
      </UButton>
      <UButton v-if="detail.payments.length" color="neutral" variant="soft" icon="i-lucide-receipt" @click="emit('openReceipt')">
        Ver ultimo recibo
      </UButton>
      <UBadge v-if="detail.isOpenEnded" color="warning" variant="soft">Indefinida</UBadge>
      <UBadge v-if="hasExtension" color="primary" variant="soft">Extendida</UBadge>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <UCard>
        <template #header><h3 class="font-semibold">Fechas</h3></template>
        <div class="space-y-1 text-sm">
          <p><span class="text-slate-500">Entrada planificada:</span> {{ detail.checkIn }}</p>
          <p><span class="text-slate-500">Salida planificada:</span> {{ detail.checkOut }}</p>
          <p><span class="text-slate-500">Check-in real:</span> {{ detail.actualCheckInAt ? new Date(detail.actualCheckInAt).toLocaleString() : "—" }}</p>
          <p><span class="text-slate-500">Check-out real:</span> {{ detail.actualCheckOutAt ? new Date(detail.actualCheckOutAt).toLocaleString() : "—" }}</p>
          <p v-if="detail.extendedFromCheckOut"><span class="text-slate-500">Salida original:</span> {{ detail.extendedFromCheckOut }}</p>
          <p><span class="text-slate-500">Noches:</span> {{ detail.nights }}</p>
        </div>
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold">Montos</h3></template>
        <div class="space-y-1 text-sm">
          <p><span class="text-slate-500">Total:</span> ${{ detail.totalAmount.toFixed(2) }}</p>
          <p><span class="text-slate-500">Pagado:</span> ${{ detail.paidAmount.toFixed(2) }}</p>
          <p><span class="text-slate-500">Saldo:</span> <span :class="balance > 0 ? 'text-amber-600' : 'text-emerald-600'">${{ balance.toFixed(2) }}</span></p>
        </div>
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold">Origen</h3></template>
        <div class="space-y-1 text-sm">
          <p><span class="text-slate-500">Fuente:</span> {{ detail.source ?? "—" }}</p>
          <p v-if="detail.notes"><span class="text-slate-500">Notas:</span> {{ detail.notes }}</p>
          <p v-if="detail.extensionNotes"><span class="text-slate-500">Notas extensión:</span> {{ detail.extensionNotes }}</p>
        </div>
      </UCard>
    </div>

    <UCard class="mt-4">
      <template #header><h3 class="font-semibold">Habitaciones y huespedes</h3></template>
      <div class="space-y-4">
        <div v-for="room in detail.rooms" :key="room.id" class="rounded-lg border p-4">
          <h4 class="mb-2 font-medium">Hab. {{ room.roomNumber }} <span class="text-sm text-slate-500">({{ room.roomTypeName }})</span></h4>
          <div class="mb-2 text-sm text-slate-500">Precio: ${{ room.roomPrice }} × {{ detail.nights }} noche(s) = ${{ room.subtotal.toFixed(2) }}</div>
          <UiDataTable :data="room.guests" :columns="guestColumns" />
        </div>
      </div>
    </UCard>

    <UCard class="mt-4">
      <template #header><h3 class="font-semibold">Pagos</h3></template>
      <div v-if="!detail.payments.length" class="text-sm text-slate-400">Sin pagos registrados.</div>
      <UiDataTable v-else :data="detail.payments" :columns="paymentColumns" />
    </UCard>
  </div>
</template>

