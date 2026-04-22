<script setup lang="ts">
import { h, resolveComponent } from "vue";

import type {
  ServiceAssignmentCoverageItem,
  ServiceAssignmentService,
} from "@/composables/useServiceAssignment";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "service_assignment.view",
  roles: ["admin", "manager"],
});

const searchQuery = ref("");
const incompleteOnly = ref(false);
const activeTab = ref<"summary" | "coverage">("summary");
const modalOpen = ref(false);
const mutationLoading = ref(false);
const selectedService = ref<ServiceAssignmentService | null>(null);

const { loadOverview, updateCoverage } = useServiceAssignment();

const { data, pending, refresh } = await useAsyncData(
  "service-assignment-overview",
  () => loadOverview(),
  { server: false },
);

const overview = computed(() => data.value);
const filteredServices = computed(() => {
  const rows = overview.value?.services ?? [];
  const query = searchQuery.value.trim().toLowerCase();

  if (!query) {
    return rows.filter((service) => !incompleteOnly.value || service.missingCoverage);
  }

  return rows
    .filter((service) =>
      [service.name, service.categoryName ?? "", service.description ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
    .filter((service) => !incompleteOnly.value || service.missingCoverage);
});

const summary = computed(() => {
  const services = overview.value?.services ?? [];
  const totalServices = services.length;
  const incompleteServices = services.filter((service) => service.missingCoverage).length;
  const coveredServices = totalServices - incompleteServices;

  return {
    totalServices,
    coveredServices,
    incompleteServices,
  };
});

const getCoverageForService = (serviceId: string): ServiceAssignmentCoverageItem[] => {
  const branches = overview.value?.branches ?? [];
  const assignments = overview.value?.assignments ?? [];

  return branches.map((branch) => ({
    branchId: branch.id,
    userIds: assignments
      .filter((assignment) => assignment.branchId === branch.id && assignment.serviceIds.includes(serviceId))
      .map((assignment) => assignment.userId),
  }));
};

const openCoverageModal = (service: ServiceAssignmentService) => {
  selectedService.value = service;
  modalOpen.value = true;
};

const handleSaveCoverage = async (coverage: ServiceAssignmentCoverageItem[]) => {
  if (!selectedService.value) {
    return;
  }

  mutationLoading.value = true;
  try {
    await updateCoverage(selectedService.value.id, coverage);
    modalOpen.value = false;
    await refresh();
  } finally {
    mutationLoading.value = false;
  }
};

const columns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Servicio",
      cell: ({ row }: { row: { original: ServiceAssignmentService } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.name),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, `${row.original.durationMinutes} min · Bs ${row.original.price.toFixed(2)}`),
        ]),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      cell: ({ row }: { row: { original: ServiceAssignmentService } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.categoryName ?? "Sin categoria"),
    },
    {
      accessorKey: "coverage",
      header: "Cobertura",
      cell: ({ row }: { row: { original: ServiceAssignmentService } }) =>
        h("div", { class: "space-y-1.5 min-w-[10rem]" }, [
          h("p", { class: "text-sm font-medium text-slate-700 dark:text-slate-200" }, `${row.original.coveredBranchesCount}/${row.original.totalBranches} sucursales`),
          h("div", { class: "h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" }, [
            h("div", {
              class: "h-full rounded-full bg-emerald-500 transition-all",
              style: { width: `${row.original.coveragePercent}%` },
            }),
          ]),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, `${row.original.coveragePercent}% cobertura`),
        ]),
    },
    {
      accessorKey: "missingCoverage",
      header: "Estado",
      cell: ({ row }: { row: { original: ServiceAssignmentService } }) =>
        h(UBadge, { color: row.original.missingCoverage ? "warning" : "success", variant: "soft" }, () => row.original.missingCoverage ? "Sin cobertura" : "Cubierto"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: ServiceAssignmentService } }) =>
        h(UButton, {
          size: "sm",
            color: "primary",
            variant: "soft",
            class: "min-h-10",
            onClick: () => openCoverageModal(row.original),
        }, () => "Gestionar cobertura"),
    },
  ];
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <div class="flex flex-wrap gap-2">
      <UButton :variant="activeTab === 'summary' ? 'solid' : 'soft'" :color="activeTab === 'summary' ? 'primary' : 'neutral'" @click="activeTab = 'summary'">
        Resumen
      </UButton>
      <UButton :variant="activeTab === 'coverage' ? 'solid' : 'soft'" :color="activeTab === 'coverage' ? 'primary' : 'neutral'" @click="activeTab = 'coverage'">
        Cobertura
      </UButton>
    </div>

    <UiSectionShell
      v-if="activeTab === 'summary'"
      eyebrow="Resumen"
      title="Estado general de cobertura"
      description="Revisa capacidad global y entra a la gestion detallada por servicio."
    >
      <UiModuleHero
        eyebrow="Cobertura operativa"
        title="Asignacion de servicio"
        description="Define que usuarios pueden prestar cada servicio por sucursal para que citas y POS respeten la cobertura real."
        icon="i-lucide-users-round"
      />

      <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Servicios totales</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ summary.totalServices }}</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cobertura completa</p>
          <p class="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{ summary.coveredServices }}</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cobertura pendiente</p>
          <p class="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">{{ summary.incompleteServices }}</p>
        </UCard>
      </div>

      <div class="mt-4 flex justify-end">
        <UButton color="primary" variant="soft" icon="i-lucide-users-round" @click="activeTab = 'coverage'">
          Gestionar cobertura
        </UButton>
      </div>
    </UiSectionShell>

    <UiSearchFilters v-else title="Buscar servicio" description="Filtra por nombre, categoria o descripcion." surface>
      <template #controls>
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="Buscar servicio..." :ui="{ base: 'min-h-11 text-base' }" />
          <UCheckbox v-model="incompleteOnly" label="Solo cobertura incompleta" :ui="{ base: 'min-h-11' }" />
        </div>
      </template>
      <template #summary>
        {{ filteredServices.length }} servicio(s)
      </template>
    </UiSearchFilters>

    <div v-if="activeTab === 'coverage'" class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Servicios totales</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ summary.totalServices }}</p>
      </UCard>
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cobertura completa</p>
        <p class="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{ summary.coveredServices }}</p>
      </UCard>
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cobertura pendiente</p>
        <p class="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">{{ summary.incompleteServices }}</p>
      </UCard>
    </div>

    <UiDataTable
      v-if="activeTab === 'coverage'"
      :data="filteredServices"
      :columns="columns"
      :loading="pending"
      empty="No hay servicios para asignar."
      min-width-class="min-w-[68rem] rounded-[1.5rem]"
    />

    <ModalsServiceCoverageModal
      :open="modalOpen"
      :loading="mutationLoading"
      :service="selectedService"
      :branches="overview?.branches ?? []"
      :branch-users="overview?.branchUsers ?? []"
      :coverage="selectedService ? getCoverageForService(selectedService.id) : []"
      @update:open="modalOpen = $event"
      @save="handleSaveCoverage"
    />
  </div>
</template>
