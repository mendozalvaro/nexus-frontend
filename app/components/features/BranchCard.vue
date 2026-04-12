<script setup lang="ts">
import type { BranchListItem } from "@/composables/useBranches";

const props = defineProps<{
  branch: BranchListItem;
}>();

const emits = defineEmits<{
  view: [string];
  toggleStatus: [{ branchId: string; nextState: boolean }];
}>();

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(value);
};

const statusColor = computed(() => (props.branch.isActive ? "success" : "neutral"));
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
              {{ branch.name }}
            </h3>
            <UBadge :color="statusColor" variant="soft">
              {{ branch.isActive ? "Activa" : "Inactiva" }}
            </UBadge>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <span>{{ branch.code }}</span>
            <span v-if="branch.phone">• {{ branch.phone }}</span>
          </div>
        </div>

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-right"
          @click="emits('view', branch.id)"
        >
          Ver detalle
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <p class="min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {{ branch.address ?? "Sin dirección registrada todavía." }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Ventas
          </p>
          <p class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {{ formatCurrency(branch.stats.salesTotal) }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ branch.stats.salesCount }} transacción(es)
          </p>
        </div>

        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Equipo
          </p>
          <p class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {{ branch.stats.employeesCount }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            colaborador(es)
          </p>
        </div>

        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Citas
          </p>
          <p class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {{ branch.stats.appointmentsCount }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            registradas
          </p>
        </div>

        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p class="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Stock crítico
          </p>
          <p class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {{ branch.stats.lowStockCount }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            producto(s)
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-wrap justify-end gap-3">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-pen-square"
          @click="emits('view', branch.id)"
        >
          Editar
        </UButton>

        <UButton
          :color="branch.isActive ? 'error' : 'success'"
          variant="soft"
          :icon="branch.isActive ? 'i-lucide-power-off' : 'i-lucide-badge-check'"
          @click="emits('toggleStatus', { branchId: branch.id, nextState: !branch.isActive })"
        >
          {{ branch.isActive ? "Desactivar" : "Activar" }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
