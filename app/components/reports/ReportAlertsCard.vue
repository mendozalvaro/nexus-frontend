<script setup lang="ts">
import type { ProductsReportData, AppointmentsReportData } from "@/composables/useReports";

const props = defineProps<{
  productsData: ProductsReportData | null;
  appointmentsData: AppointmentsReportData | null;
}>();

interface Alert {
  icon: string;
  tone: "warning" | "error" | "info" | "success";
  message: string;
  detail?: string;
}

const alerts = computed<Alert[]>(() => {
  const result: Alert[] = [];

  const lowStock = props.productsData?.lowStock ?? [];
  for (const item of lowStock) {
    result.push({
      icon: "i-lucide-triangle-alert",
      tone: "warning",
      message: `Stock bajo: ${item.label}`,
      detail: `Minimo ${item.value}`,
    });
  }

  const apptStatus = props.appointmentsData?.statusBreakdown ?? [];
  const cancelled = apptStatus.find((a) => a.label === "Cancelada")?.value ?? 0;
  const noShow = apptStatus.find((a) => a.label === "No asistio")?.value ?? 0;
  const total = apptStatus.reduce((sum, a) => sum + a.value, 0);

  if (cancelled > 0) {
    result.push({
      icon: "i-lucide-circle-x",
      tone: "error",
      message: `${cancelled} cita(s) cancelada(s)`,
      detail: `${total > 0 ? Math.round((cancelled / total) * 100) : 0}% del total`,
    });
  }

  if (noShow > 0) {
    result.push({
      icon: "i-lucide-clock-alert",
      tone: "warning",
      message: `${noShow} cita(s) no asistieron`,
      detail: `${total > 0 ? Math.round((noShow / total) * 100) : 0}% del total`,
    });
  }

  if (result.length === 0) {
    result.push({
      icon: "i-lucide-circle-check",
      tone: "success",
      message: "Sin alertas en este periodo",
      detail: "Todo opera dentro de lo esperado",
    });
  }

  return result;
});
</script>

<template>
  <UCard class="rounded-2xl border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <template #header>
      <h3 class="text-base font-semibold text-slate-950 dark:text-white">
        Alertas
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Senales operativas del periodo
      </p>
    </template>

    <div class="space-y-3">
      <div
        v-for="(alert, index) in alerts"
        :key="index"
        class="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-800/60"
      >
        <UIcon
          :name="alert.icon"
          class="mt-0.5 h-5 w-5 shrink-0"
          :class="{
            'text-amber-500': alert.tone === 'warning',
            'text-red-500': alert.tone === 'error',
            'text-sky-500': alert.tone === 'info',
            'text-emerald-500': alert.tone === 'success',
          }"
        />
        <div>
          <p class="text-sm font-medium text-slate-900 dark:text-white">
            {{ alert.message }}
          </p>
          <p v-if="alert.detail" class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {{ alert.detail }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
