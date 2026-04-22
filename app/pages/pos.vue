<script setup lang="ts">
import type { AccessibleBranch } from "@/types/permissions";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.view",
  roles: ["admin", "manager", "employee"],
  requiresBranch: true,
});

const { profile } = useAuth();
const { getAccessibleBranches } = usePermissions();

const branchLoading = ref(false);
const availableBranches = ref<AccessibleBranch[]>([]);
const selectedBranchId = ref<string | null>(null);

const isAdmin = computed(() => profile.value?.role === "admin");
const canSwitchBranchInPos = computed(() => isAdmin.value && availableBranches.value.length > 1);
const selectedBranch = computed(() =>
  availableBranches.value.find((branch) => branch.id === selectedBranchId.value)
  ?? availableBranches.value[0]
  ?? null,
);

const loadPosBranchContext = async () => {
  branchLoading.value = true;

  try {
    availableBranches.value = await getAccessibleBranches();

    if (availableBranches.value.length === 0) {
      selectedBranchId.value = null;
      return;
    }

    const stillValid = availableBranches.value.some((branch) => branch.id === selectedBranchId.value);
    if (!stillValid) {
      selectedBranchId.value = availableBranches.value[0]?.id ?? null;
    }
  } finally {
    branchLoading.value = false;
  }
};

await loadPosBranchContext();
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Operacion"
      title="Punto de Venta"
      description="Prepara una experiencia de cobro hibrida, rapida y clara para caja, servicios y flujo comercial en sucursal."
      icon="i-lucide-shopping-cart"
    />

    <UCard
      v-if="isAdmin"
      class="rounded-[1.5rem] border border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20"
    >
      <template #header>
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
            Contexto de venta
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Este contexto fija la sucursal para el formulario de venta en POS.
          </p>
        </div>
      </template>

      <div v-if="availableBranches.length === 0" class="space-y-3">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Sin sucursales activas"
          description="Necesitas al menos una sucursal para operar ventas."
        />
        <UButton to="/branches" color="primary" variant="soft">
          Ir a sucursales
        </UButton>
      </div>

      <div v-else-if="canSwitchBranchInPos" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Sucursal de venta
        </p>
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="selectedBranchId" class="w-full bg-transparent outline-none" :disabled="branchLoading">
            <option v-for="branch in availableBranches" :key="branch.id" :value="branch.id">
              {{ branch.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-else class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Sucursal de venta
        </p>
        <p class="text-sm font-semibold text-slate-900 dark:text-white">
          {{ selectedBranch?.name ?? "Sin sucursal" }}
        </p>
      </div>
    </UCard>

    <UiEmptyModuleState
      title="Punto de venta en preparacion"
      description="Estamos terminando la experiencia completa del POS para ventas rapidas, carrito hibrido y atajos operativos."
      icon="i-lucide-shopping-cart"
    >
      <template #actions>
        <UButton to="/dashboard" color="neutral" variant="soft">
          Volver al dashboard
        </UButton>
        <UButton to="/appointments" color="primary" variant="soft">
          Abrir agenda
        </UButton>
      </template>
    </UiEmptyModuleState>
  </div>
</template>
