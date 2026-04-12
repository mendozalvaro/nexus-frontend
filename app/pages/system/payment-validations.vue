<script setup lang="ts">
import PaymentValidationTable from "../../components/admin/PaymentValidationTable.vue";
import RejectModal from "../../components/admin/RejectModal.vue";
import ValidationDetailModal from "../../components/admin/ValidationDetailModal.vue";

import type {
  PaymentSystemFilters,
  PaymentValidationListRow,
} from "@/composables/usePaymentSystem";

definePageMeta({
  middleware: ["system-only"],
  title: "Validacion de pagos",
});

const supportOpen = ref(false);
const detailOpen = ref(false);
const rejectOpen = ref(false);
const rejectTarget = ref<PaymentValidationListRow | null>(null);
const filters = reactive<PaymentSystemFilters>(usePaymentSystem().getDefaultFilters());

const {
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
  pageCount,
  totalValidations,
  resolveSystemUser,
  refreshData,
  openValidationDetail,
  closeValidationDetail,
  reviewValidation,
} = usePaymentSystem();

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const handleRefresh = async () => {
  await refreshData(filters);
};

const openDetailModal = async (row: PaymentValidationListRow) => {
  detailOpen.value = true;
  await openValidationDetail(row.id);
};

const openRejectModal = (row: PaymentValidationListRow) => {
  rejectTarget.value = row;
  rejectOpen.value = true;
};

const approveValidation = async (row: PaymentValidationListRow) => {
  await reviewValidation({
    validationId: row.id,
    decision: "approved",
    filters,
  });
};

const rejectValidation = async (reason: string) => {
  if (!rejectTarget.value) {
    return;
  }

  await reviewValidation({
    validationId: rejectTarget.value.id,
    decision: "rejected",
    reason,
    filters,
  });

  rejectOpen.value = false;
  rejectTarget.value = null;
};

const clearFilters = async () => {
  Object.assign(filters, {
    search: "",
    status: "pending",
    dateFrom: "",
    dateTo: "",
  } satisfies PaymentSystemFilters);
  page.value = 1;
  await refreshData(filters);
};

watch(
  () => [filters.status, filters.dateFrom, filters.dateTo],
  async () => {
    page.value = 1;
    await refreshData(filters);
  },
);

watch(
  () => filters.search,
  () => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    searchTimer = setTimeout(async () => {
      page.value = 1;
      await refreshData(filters);
    }, 300);
  },
);

watch(page, async () => {
  await refreshData(filters);
});

watch(detailOpen, (isOpen) => {
  if (!isOpen) {
    closeValidationDetail();
  }
});

onMounted(async () => {
  await resolveSystemUser();
  await refreshData(filters);
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <main class="px-4 py-6 sm:px-6">
      <UContainer class="space-y-6">
        <div class="space-y-4">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 class="text-2xl font-bold text-slate-950 dark:text-white">
                Validacion de pagos
              </h1>
              <p class="text-slate-600 dark:text-slate-300">
                Revisa comprobantes de onboarding y activa organizaciones solo cuando el pago sea valido.
              </p>
              <p v-if="systemUser?.email" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sesion system: {{ systemUser.email }}
              </p>
            </div>

            <UButton color="primary" icon="i-lucide-refresh-cw" :loading="loading" @click="handleRefresh">
              Actualizar
            </UButton>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <UCard class="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <UIcon name="i-lucide-clock-3" class="h-5 w-5" />
                </div>
                <div>
                  <p class="text-sm text-slate-500 dark:text-slate-400">Pendientes</p>
                  <p class="text-2xl font-bold text-slate-950 dark:text-white">{{ stats.pending }}</p>
                </div>
              </div>
            </UCard>

            <UCard class="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <UIcon name="i-lucide-check-circle-2" class="h-5 w-5" />
                </div>
                <div>
                  <p class="text-sm text-slate-500 dark:text-slate-400">Aprobados hoy</p>
                  <p class="text-2xl font-bold text-slate-950 dark:text-white">{{ stats.approvedToday }}</p>
                </div>
              </div>
            </UCard>

            <UCard class="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                  <UIcon name="i-lucide-x-circle" class="h-5 w-5" />
                </div>
                <div>
                  <p class="text-sm text-slate-500 dark:text-slate-400">Rechazados hoy</p>
                  <p class="text-2xl font-bold text-slate-950 dark:text-white">{{ stats.rejectedToday }}</p>
                </div>
              </div>
            </UCard>

            <UCard class="border-primary-200 bg-primary-50 dark:border-primary-900 dark:bg-primary-950/20">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                  <UIcon name="i-lucide-timer" class="h-5 w-5" />
                </div>
                <div>
                  <p class="text-sm text-slate-500 dark:text-slate-400">Tiempo prom.</p>
                  <p class="text-2xl font-bold text-slate-950 dark:text-white">{{ stats.avgTime }}</p>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <UAlert v-if="feedback" :color="feedback.color" variant="soft" :title="feedback.title"
          :description="feedback.description" />

        <UAlert v-if="error" color="error" variant="soft" title="No pudimos cargar el panel" :description="error" />

        <UCard class="rounded-[1.5rem]">
          <div class="flex flex-col gap-4 xl:flex-row">
            <UInput v-model="filters.search" icon="i-lucide-search"
              placeholder="Buscar por organizacion, email, referencia o archivo..." class="flex-1" />

            <div class="grid flex-none gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                <select v-model="filters.status" class="w-full bg-transparent text-sm outline-none">
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="approved">Aprobados</option>
                  <option value="rejected">Rechazados</option>
                </select>
              </div>

              <UInput v-model="filters.dateFrom" type="date" />
              <UInput v-model="filters.dateTo" type="date" />

              <UButton color="neutral" variant="soft" @click="clearFilters">
                Limpiar
              </UButton>
            </div>
          </div>
        </UCard>

        <PaymentValidationTable :rows="validations" :loading="loading" :page="page" :page-count="pageCount"
          :total="totalValidations" @view="openDetailModal" @approve="approveValidation" @reject="openRejectModal"
          @previous="page = Math.max(1, page - 1)" @next="page = Math.min(pageCount, page + 1)" />
      </UContainer>
    </main>

    <ValidationDetailModal :open="detailOpen" :validation="selectedValidation" :loading="detailLoading"
      :action-loading="actionLoading" @update:open="detailOpen = $event"
      @approve="selectedValidation && approveValidation(selectedValidation)"
      @reject="selectedValidation && openRejectModal(selectedValidation)" />

    <RejectModal :open="rejectOpen" :validation="rejectTarget" :submitting="actionLoading"
      @update:open="rejectOpen = $event" @submit="rejectValidation" />

    <UModal :open="supportOpen" title="Soporte interno NexusPOS"
      description="Placeholder para handoff con soporte, email y playbooks de revision."
      @update:open="supportOpen = $event">
      <template #body>
        <div class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>Fase 2 integrara playbooks internos, notas compartidas y notificaciones operativas.</p>
          <p>Por ahora, documenta casos especiales en audit_logs y coordina por el canal interno del equipo.</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
