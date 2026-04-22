<script setup lang="ts">
import type { BranchListItem } from "@/composables/useBranches";

const props = defineProps<{
  branches: BranchListItem[];
  loading?: boolean;
}>();

const metrics = computed(() => {
  const totalBranches = props.branches.length;
  const activeBranches = props.branches.filter((branch) => branch.isActive).length;
  const inactiveBranches = totalBranches - activeBranches;
  const employeesCount = props.branches.reduce(
    (total, branch) => total + branch.stats.employeesCount,
    0,
  );
  const lowStockAlerts = props.branches.reduce(
    (total, branch) => total + branch.stats.lowStockCount,
    0,
  );

  return {
    totalBranches,
    activeBranches,
    inactiveBranches,
    employeesCount,
    lowStockAlerts,
  };
});

</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Administracion"
      title="Sucursales"
      description="Gestiona sucursales, estados y configuracion operativa para tu organizacion desde un espacio centralizado."
      icon="i-lucide-building-2"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <UiStatCard
        label="Sucursales"
        :value="metrics.totalBranches"
        icon="i-lucide-building-2"
        icon-class="text-sky-600 dark:text-sky-300"
        icon-wrapper-class="bg-sky-100 dark:bg-sky-950/50"
      />
      <UiStatCard
        label="Activas"
        :value="metrics.activeBranches"
        icon="i-lucide-badge-check"
        icon-class="text-emerald-600 dark:text-emerald-300"
        icon-wrapper-class="bg-emerald-100 dark:bg-emerald-950/50"
      />
      <UiStatCard
        label="Inactivas"
        :value="metrics.inactiveBranches"
        icon="i-lucide-power-off"
        icon-class="text-slate-600 dark:text-slate-300"
        icon-wrapper-class="bg-slate-100 dark:bg-slate-900/60"
      />
      <UiStatCard
        label="Equipo"
        :value="metrics.employeesCount"
        icon="i-lucide-users"
        icon-class="text-indigo-600 dark:text-indigo-300"
        icon-wrapper-class="bg-indigo-100 dark:bg-indigo-950/50"
      />
      <UiStatCard
        label="Alertas stock"
        :value="metrics.lowStockAlerts"
        icon="i-lucide-triangle-alert"
        icon-class="text-amber-600 dark:text-amber-300"
        icon-wrapper-class="bg-amber-100 dark:bg-amber-950/50"
      />
    </div>
  </div>
</template>
