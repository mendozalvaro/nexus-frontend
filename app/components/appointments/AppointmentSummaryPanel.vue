<script setup lang="ts">
import type { AppointmentDashboardResult } from "@/composables/useAppointmentDashboard";

const props = defineProps<{
  dashboard: AppointmentDashboardResult | null;
  loading: boolean;
}>();

const emits = defineEmits<{
  navigate: ["citas"];
}>();

const { formatCurrency, formatPercent } = useAppointmentDashboard();
</script>

<template>
  <UiSectionShell
    eyebrow="Resumen"
    title="Vista general de la agenda"
    description="Revisa los indicadores del dia y gestiona citas desde un solo modulo."
  >
    <template v-if="loading">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <USkeleton v-for="i in 5" :key="i" class="h-28 rounded-[24px]" />
      </div>
    </template>

    <template v-else-if="dashboard">
      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <UCard class="rounded-[1.25rem]">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total citas hoy</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ dashboard.daily.stats.total }}</p>
          <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'citas')">
            Ver citas
          </UButton>
        </UCard>

        <UCard class="rounded-[1.25rem]">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Ocupacion</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ formatPercent(dashboard.daily.occupancyPercent) }}</p>
          <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">{{ dashboard.daily.occupiedSlots }} / {{ dashboard.daily.totalSlots }} slots</p>
        </UCard>

        <UCard class="rounded-[1.25rem]">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Ingreso estimado</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ formatCurrency(dashboard.daily.estimatedRevenue) }}</p>
          <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">BOB del dia</p>
        </UCard>

        <UCard class="rounded-[1.25rem]">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">No asistio (semanal)</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ formatPercent(dashboard.weeklyNoShow.noShowPercent) }}</p>
          <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">{{ dashboard.weeklyNoShow.noShowCount }} de {{ dashboard.weeklyNoShow.total }}</p>
        </UCard>

        <UCard class="rounded-[1.25rem]">
          <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Confirmadas</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ dashboard.daily.stats.confirmed }}</p>
          <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">{{ dashboard.daily.stats.pending }} pendientes</p>
        </UCard>
      </div>

      <div v-if="dashboard.topEmployees.length > 0" class="mt-6">
        <h3 class="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Top empleados del dia
        </h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <UCard v-for="emp in dashboard.topEmployees" :key="emp.id" class="rounded-[1.25rem]">
            <p class="text-sm font-medium text-slate-950 dark:text-white">{{ emp.fullName }}</p>
            <p class="mt-1 text-xl font-semibold text-primary-600 dark:text-primary-400">{{ emp.appointmentCount }} cita{{ emp.appointmentCount !== 1 ? 's' : '' }}</p>
          </UCard>
        </div>
      </div>
    </template>

    <template v-else>
      <UiEmptyModuleState
        title="Sin datos disponibles"
        description="No hay informacion de agenda para mostrar en este momento."
        icon="i-lucide-calendar-search"
      />
    </template>
  </UiSectionShell>
</template>
