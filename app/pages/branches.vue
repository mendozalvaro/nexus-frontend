<script setup lang="ts">
import { h, resolveComponent } from "vue";
import BranchForm from "@/components/forms/BranchForm.vue";

import type {
  BranchListItem,
  BranchMutationPayload,
} from "@/composables/useBranches";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "branches.view",
  roles: ["admin"],
  featureFlag: "feature_multi_branch",
});

const searchQuery = ref("");
const mutationLoading = ref(false);
const branchModalOpen = ref(false);
const editingBranch = ref<BranchListItem | null>(null);

const {
  loadBranches,
  createBranch,
  updateBranch,
  updateBranchStatus,
  branchLimitMessage,
  canCreateMoreBranches,
} = useBranches();

const { data, refresh } = await useAsyncData(
  "branches-module",
  () => loadBranches(),
  { server: false },
);

const branchList = computed(() => data.value?.branches ?? []);
const filteredBranches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return branchList.value;
  }

  return branchList.value.filter((branch) =>
    [branch.name, branch.code, branch.address ?? "", branch.phone ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const openBranchModal = (branch?: BranchListItem) => {
  editingBranch.value = branch ?? null;
  branchModalOpen.value = true;
};

const editingBranchInitial = computed<BranchMutationPayload | undefined>(() => {
  if (!editingBranch.value) {
    return undefined;
  }

  return {
    name: editingBranch.value.name,
    code: editingBranch.value.code,
    address: editingBranch.value.address ?? "",
    phone: editingBranch.value.phone ?? "",
    settings: editingBranch.value.settings,
  };
});

const handleBranchSubmit = async (payload: BranchMutationPayload) => {
  mutationLoading.value = true;
  try {
    if (editingBranch.value) {
      await updateBranch(editingBranch.value.id, payload);
    } else {
      await createBranch(payload);
    }

    branchModalOpen.value = false;
    editingBranch.value = null;
    await refresh();
  } finally {
    mutationLoading.value = false;
  }
};

const handleBranchStatusChange = async (branchId: string, isActive: boolean) => {
  try {
    const result = await updateBranchStatus(branchId, isActive);
    console.log("Branch status updated successfully:", result);
    // Refrescar datos después de actualización exitosa
    await new Promise(resolve => setTimeout(resolve, 300));
    await refresh();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error updating branch status:", errorMessage);
  }
};

const branchColumns = computed(() => {
  const UBadge = resolveComponent("UBadge");
  const UButton = resolveComponent("UButton");

  return [
    {
      accessorKey: "name",
      header: "Sucursal",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("div", { class: "space-y-1" }, [
          h("p", { class: "font-medium text-slate-950 dark:text-white" }, row.original.name),
          h("p", { class: "text-xs text-slate-500 dark:text-slate-400" }, row.original.code),
        ]),
    },
    {
      accessorKey: "address",
      header: "Dirección",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.address ?? "No definida"),
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, row.original.phone ?? "No asignado"),
    },
    {
      accessorKey: "stats.employeesCount",
      header: "Empleados",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm text-slate-600 dark:text-slate-300" }, `${row.original.stats.employeesCount}`),
    },
    {
      accessorKey: "stats.salesTotal",
      header: "Ventas",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("span", { class: "text-sm font-medium text-slate-950 dark:text-white" }, `Bs ${row.original.stats.salesTotal.toFixed(2)}`),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h(UBadge, { color: row.original.isActive ? "success" : "neutral", variant: "soft" }, () => row.original.isActive ? "Activo" : "Inactivo"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }: { row: { original: BranchListItem } }) =>
        h("div", { class: "flex flex-col gap-2 sm:flex-row" }, [
          h(UButton, { size: "sm", color: "neutral", variant: "ghost", class: "min-h-10", onClick: () => openBranchModal(row.original) }, () => "Editar"),
          h(UButton, { size: "sm", color: row.original.isActive ? "error" : "success", variant: "ghost", class: "min-h-10", onClick: () => handleBranchStatusChange(row.original.id, !row.original.isActive) }, () => row.original.isActive ? "Desactivar" : "Activar"),
        ]),
    },
  ];
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero eyebrow="Administracion" title="Sucursales"
      description="Gestiona sucursales, estados y configuracion operativa para tu organizacion desde un espacio centralizado."
      icon="i-lucide-building-2">
      <template #actions>
        <UButton color="primary" icon="i-lucide-plus" @click="openBranchModal()" :disabled="!canCreateMoreBranches">
          Nueva sucursal
        </UButton>
      </template>
    </UiModuleHero>

    <UiSearchFilters title="Buscar sucursales" description="Filtra por nombre, codigo, direccion o telefono." surface>
      <template #controls>
        <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="Buscar..."
          :ui="{ base: 'min-h-11 text-base' }" />
      </template>
      <template #summary>
        {{ filteredBranches.length }} sucursal(es)
      </template>
    </UiSearchFilters>

    <UiDataTable :data="filteredBranches" :columns="branchColumns" :loading="false"
      empty="No hay sucursales disponibles." min-width-class="min-w-[60rem] rounded-[1.5rem]" />

    <UModal :open="branchModalOpen" :title="editingBranch ? 'Editar sucursal' : 'Nueva sucursal'"
      :description="editingBranch ? 'Actualiza los datos de la sucursal.' : 'Crea una sucursal para tu organizacion.'"
      @update:open="branchModalOpen = $event">
      <template #body>
        <BranchForm :mode="editingBranch ? 'edit' : 'create'" :loading="mutationLoading"
          :initial-value="editingBranchInitial" :submit-label="editingBranch ? 'Guardar cambios' : 'Crear sucursal'"
          :limit-message="editingBranch ? null : branchLimitMessage" @submit="handleBranchSubmit"
          @cancel="branchModalOpen = false" />
      </template>
    </UModal>
  </div>
</template>
