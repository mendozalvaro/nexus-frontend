<script setup lang="ts">
import type {
  ServiceAssignmentBranch,
  ServiceAssignmentCoverageItem,
  ServiceAssignmentService,
  ServiceAssignmentUser,
} from "@/composables/useServiceAssignment";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  service: ServiceAssignmentService | null;
  branches: ServiceAssignmentBranch[];
  branchUsers: Array<{
    branchId: string;
    users: ServiceAssignmentUser[];
  }>;
  coverage: ServiceAssignmentCoverageItem[];
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  save: [ServiceAssignmentCoverageItem[]];
}>();

const internalCoverage = ref<Record<string, string[]>>({});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    internalCoverage.value = Object.fromEntries(
      props.branches.map((branch) => [
        branch.id,
        props.coverage.find((item) => item.branchId === branch.id)?.userIds ?? [],
      ]),
    );
  },
  { immediate: true },
);

const toggleUser = (branchId: string, userId: string, checked: boolean) => {
  const current = new Set(internalCoverage.value[branchId] ?? []);
  if (checked) {
    current.add(userId);
  } else {
    current.delete(userId);
  }

  internalCoverage.value = {
    ...internalCoverage.value,
    [branchId]: Array.from(current),
  };
};

const save = () => {
  emits("save", props.branches.map((branch) => ({
    branchId: branch.id,
    userIds: internalCoverage.value[branch.id] ?? [],
  })));
};

const getBranchUsers = (branchId: string): ServiceAssignmentUser[] => {
  return props.branchUsers.find((item) => item.branchId === branchId)?.users ?? [];
};
</script>

<template>
  <UModal
    :open="open"
    :title="service ? `Cobertura de ${service.name}` : 'Cobertura de servicio'"
    description="Define que usuarios pueden prestar este servicio en cada sucursal disponible."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div
          v-for="branch in branches"
          :key="branch.id"
          class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
        >
          <div class="mb-3">
            <p class="font-medium text-slate-950 dark:text-white">
              {{ branch.name }}
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ branch.address || branch.code || "Sin direccion registrada" }}
            </p>
          </div>

          <div v-if="getBranchUsers(branch.id).length > 0" class="space-y-2">
            <div
              v-for="user in getBranchUsers(branch.id)"
              :key="user.id"
              class="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70"
            >
              <div>
                <p class="font-medium text-slate-950 dark:text-white">
                  {{ user.fullName }}
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ user.role ? user.role.toUpperCase() : "Sin rol" }}
                </p>
              </div>

              <UCheckbox
                :model-value="(internalCoverage[branch.id] ?? []).includes(user.id)"
                @update:model-value="toggleUser(branch.id, user.id, Boolean($event))"
              />
            </div>
          </div>

          <UAlert
            v-else
            color="warning"
            variant="soft"
            icon="i-lucide-alert-triangle"
            title="Sin personal elegible en esta sucursal"
            description="Asigna usuarios a la sucursal desde Usuarios para habilitar cobertura."
          />
        </div>

        <UiResponsiveModalActions>
          <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('update:open', false)">
            Cancelar
          </UButton>
          <UButton color="primary" block class="min-h-11 sm:w-auto" :loading="loading" @click="save">
            Guardar cobertura
          </UButton>
        </UiResponsiveModalActions>
      </div>
    </template>
  </UModal>
</template>
