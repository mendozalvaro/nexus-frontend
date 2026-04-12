<script setup lang="ts">
import type {
  DashboardAccountStatus,
  LimitedDashboardStats,
} from "@/composables/useDashboard";

const props = defineProps<{
  accountStatus: DashboardAccountStatus;
  stats: LimitedDashboardStats;
}>();

const statCards = computed(() => [
  {
    label: "Ventas del Mes",
    value: props.accountStatus === "active" ? "$0.00" : "$0.00",
    icon: "i-heroicons-currency-dollar",
    tone: "primary" as const,
    locked: props.accountStatus !== "active",
  },
  {
    label: "Citas del Mes",
    value: props.accountStatus === "active" ? "0" : "0",
    icon: "i-heroicons-calendar-days",
    tone: "warning" as const,
    locked: props.accountStatus !== "active",
  },
  {
    label: "Productos Configurados",
    value: String(props.stats.products),
    icon: "i-heroicons-archive-box",
    tone: "success" as const,
    locked: false,
  },
  {
    label: "Empleados Registrados",
    value: String(props.stats.employees),
    icon: "i-heroicons-users",
    tone: "info" as const,
    locked: false,
  },
]);

const toneClass = (tone: "primary" | "warning" | "success" | "info") => {
  return {
    primary: "bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  }[tone];
};
</script>

<template>
  <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    <UCard
      v-for="card in statCards"
      :key="card.label"
      class="relative overflow-hidden rounded-[1.5rem]"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{{ card.value }}</p>
        </div>

        <div
          class="flex h-12 w-12 items-center justify-center rounded-full"
          :class="toneClass(card.tone)"
        >
          <UIcon :name="card.icon" class="h-6 w-6" />
        </div>
      </div>

      <div
        v-if="card.locked"
        class="absolute inset-0 flex items-center justify-center bg-slate-100/65 backdrop-blur-[1px] dark:bg-slate-950/65"
      >
        <div class="text-center">
          <UIcon name="i-heroicons-lock-closed" class="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p class="text-xs text-slate-500 dark:text-slate-400">Disponible tras activacion</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
