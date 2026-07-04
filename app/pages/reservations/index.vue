<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { ReservationListItem, ReservationFilters } from "@/composables/useReservations";
import { RESERVATION_STATUS_OPTIONS, getReservationStatusMeta } from "@/composables/useReservations";
import ReservationCreateForm from "@/components/reservations/views/ReservationCreateForm.vue";
import ReservationsSummaryPanel from "@/components/reservations/ReservationsSummaryPanel.vue";
import ReservationsToolbar from "@/components/reservations/ReservationsToolbar.vue";
import ReservationsListPanel from "@/components/reservations/ReservationsListPanel.vue";
import ReservationsTabs from "@/components/reservations/ReservationsTabs.vue";
import ReservationsActiveRoomsPanel from "@/components/reservations/ReservationsActiveRoomsPanel.vue";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "reservations.view",
  roles: ["admin", "manager", "employee"],
  moduleKey: "reservations",
});

const { loadReservations, loadRoomBoard } = useReservations();
const { ensureContext } = useUserContext();
const session = useSupabaseSession();
const today = new Date();
const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

const activeTab = ref<"summary" | "list">("summary");
const createModalOpen = ref(false);
const loading = ref(false);
const rows = ref<ReservationListItem[]>([]);
const roomBoard = ref<Awaited<ReturnType<typeof loadRoomBoard>>>([]);
const total = ref(0);
const error = ref<string | null>(null);
const page = ref(1);
const perPage = 20;

const filters = reactive<ReservationFilters>({
  status: "",
  search: "",
  fromDate: monthStart,
  toDate: monthEnd,
});

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await ensureContext({ requireProfile: true, forceUserValidation: true });
    const [result, board] = await Promise.all([
      loadReservations({ ...filters, page: page.value, perPage }),
      loadRoomBoard(filters.branchId),
    ]);
    rows.value = result.rows;
    total.value = result.total;
    roomBoard.value = board;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "No se pudieron cargar las reservas.";
  } finally {
    loading.value = false;
  }
};

const summary = computed(() => {
  const checkedIn = rows.value.filter((r) => r.status === "checked_in").length;
  const checkedOut = rows.value.filter((r) => r.status === "checked_out").length;
  const withBalance = rows.value.filter((r) => r.balance > 0).length;
  return { total: total.value, checkedIn, checkedOut, withBalance };
});

const statusFilterOptions = computed(() =>
  RESERVATION_STATUS_OPTIONS.filter((opt) => opt.value !== "").map((opt) => ({ label: opt.label, value: opt.value as string })),
);

const applyFilters = async () => { page.value = 1; await load(); };
const clearFilters = async () => {
  Object.assign(filters, { status: "", search: "", fromDate: monthStart, toDate: monthEnd });
  page.value = 1;
  await load();
};

const viewDetail = (id: string) => navigateTo(`/reservations/${id}`);
const goToPOSPayment = (id: string) => navigateTo(`/reservations/${id}?openPayment=1`);
const goToCreate = () => {
  activeTab.value = "summary";
  createModalOpen.value = true;
};
const handleTabNavigate = (tab: "summary" | "list") => {
  activeTab.value = tab;
};
const handleCreated = async (payload: { reservationId: string; goToPayment: boolean }) => {
  await load();
  createModalOpen.value = false;
  activeTab.value = "summary";
  if (payload.goToPayment) {
    await navigateTo(`/reservations/${payload.reservationId}?openPayment=1`);
  }
};
const handleCancelCreate = () => { createModalOpen.value = false; };
const openRoomDetail = (reservationId: string) => navigateTo(`/reservations/${reservationId}`);
const openRoomPayment = (reservationId: string) => navigateTo(`/reservations/${reservationId}?openPayment=1`);
const openRoomCheckout = (reservationId: string) => navigateTo(`/reservations/${reservationId}?openStay=check_out`);
const openRoomExtend = (reservationId: string) => navigateTo(`/reservations/${reservationId}?openStay=extend_stay`);

const reservationColumns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    { accessorKey: "guestName", header: "Huesped" },
    { accessorKey: "roomNumbers", header: "Habitacion(es)" },
    { accessorKey: "roomTypeNames", header: "Tipo" },
    { accessorKey: "checkIn", header: "Entrada" },
    {
      accessorKey: "checkOut",
      header: "Salida",
      cell: ({ row }: { row: { original: ReservationListItem } }) =>
        h("div", { class: "space-y-1" }, [
          h("div", row.original.checkOut),
          row.original.extendedFromCheckOut
            ? h("div", { class: "text-xs text-primary-600" }, `Ext. desde ${row.original.extendedFromCheckOut}`)
            : null,
        ]),
    },
    { accessorKey: "nights", header: "Noches" },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }: { row: { original: ReservationListItem } }) =>
        h("span", { class: "font-medium" }, `$${row.original.totalAmount.toFixed(2)}`),
    },
    {
      accessorKey: "balance",
      header: "Saldo",
      cell: ({ row }: { row: { original: ReservationListItem } }) =>
        h("span", {
          class: row.original.balance > 0 ? "text-amber-600 font-medium" : "text-emerald-600 font-medium",
        }, `$${row.original.balance.toFixed(2)}`),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }: { row: { original: ReservationListItem } }) => {
        const meta = getReservationStatusMeta(row.original);
        return h(UBadge, {
          color: meta.color,
          variant: "soft",
          size: "sm",
        }, { default: () => meta.label });
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: ReservationListItem } }) =>
        h("div", { class: "flex justify-end gap-1" }, [
          row.original.balance > 0
            ? h(UButton, {
              icon: "i-lucide-credit-card",
              color: "primary",
              variant: "ghost",
              size: "sm",
              onClick: () => goToPOSPayment(row.original.id),
            })
            : null,
          h(UButton, {
            icon: "i-lucide-eye",
            color: "neutral",
            variant: "ghost",
            size: "sm",
            onClick: () => viewDetail(row.original.id),
          }),
        ]),
    },
  ];
});

onMounted(async () => { await load(); });

watch(
  () => session.value?.access_token ?? null,
  async (token, previousToken) => {
    if (!token || token === previousToken) {
      return;
    }

    if (rows.value.length === 0 && roomBoard.value.length === 0 && !loading.value) {
      await load();
    }
  },
);
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-x" :title="error" />
    <ReservationsTabs
      v-model="activeTab"
      :summary-count="summary.checkedIn"
      :history-count="summary.total"
    />

    <div v-if="activeTab === 'summary'" class="space-y-6">
      <ReservationsSummaryPanel
        :total="summary.total"
        :checked-in="summary.checkedIn"
        :checked-out="summary.checkedOut"
        :with-balance="summary.withBalance"
        @navigate="handleTabNavigate"
        @create="goToCreate"
      />
      <ReservationsActiveRoomsPanel
        :rooms="roomBoard"
        @create="goToCreate"
        @detail="openRoomDetail"
        @payment="openRoomPayment"
        @checkout="openRoomCheckout"
        @extend="openRoomExtend"
      />
    </div>

    <div v-else class="space-y-6">
      <ReservationsToolbar
        :search-query="filters.search ?? ''"
        :loading="loading"
        :total-rows="total"
        @update:search-query="filters.search = $event ?? ''"
        @refresh="load"
        @create="goToCreate"
      />

      <ReservationsListPanel
        :filters="filters"
        :status-filter-options="statusFilterOptions"
        :loading="loading"
        :rows="rows"
        :columns="reservationColumns"
        @clear="clearFilters"
        @apply="applyFilters"
      />
    </div>

    <UModal
      v-model:open="createModalOpen"
      title="Nuevo ingreso"
      description="Registra la habitacion, los huespedes y el pago inicial si corresponde."
      :ui="{ content: 'max-w-5xl' }"
    >
      <template #body>
        <ReservationCreateForm @created="handleCreated" @cancel="handleCancelCreate" />
      </template>
    </UModal>
  </div>
</template>
