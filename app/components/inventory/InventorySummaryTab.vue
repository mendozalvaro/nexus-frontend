<script setup lang="ts">
import type { InventoryMetricCard } from "@/composables/useInventoryPage";
import type { InventoryOverviewData, InventoryMovementRowView } from "@/composables/useInventory";

const props = defineProps<{
  overview: InventoryOverviewData | null;
  metrics: InventoryMetricCard[];
  formatDateTime: (value: string | null) => string;
  getMovementLabel: (value: InventoryMovementRowView["movementType"]) => string;
  getMovementColor: (value: InventoryMovementRowView["movementType"]) => "success" | "warning" | "error" | "primary" | "neutral";
}>();

const emits = defineEmits<{
  openMovement: [];
  openStock: [];
  openMovements: [];
  goToStockFromAlert: [string];
}>();
</script>

<template>
  <UiSectionShell
    eyebrow="Resumen"
    title="Senales clave del inventario"
    description="Detecta rapido quiebres, movimientos recientes y prioridades para reponer o ajustar."
  >
    <UiModuleHero
      eyebrow="Operacion"
      title="Inventario"
      description="Controla existencias, registra movimientos y sigue alertas de stock sin mezclar configuracion comercial con operacion diaria."
      icon="i-lucide-boxes"
    >
      <template #actions>
        <UButton color="primary" icon="i-lucide-package-plus" @click="emits('openMovement')">
          Registrar movimiento
        </UButton>
      </template>
    </UiModuleHero>

    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStatCard
        v-for="item in props.metrics"
        :key="item.label"
        :label="item.label"
        :value="item.value"
        :icon="item.icon"
        :icon-class="item.iconClass"
        :icon-wrapper-class="item.iconWrapperClass"
      />
    </div>

    <div class="mb-4 flex justify-end gap-2">
      <UButton color="primary" variant="soft" icon="i-lucide-box" @click="emits('openStock')">
        Ir a stock
      </UButton>
      <UButton color="neutral" variant="soft" icon="i-lucide-history" @click="emits('openMovements')">
        Ver movimientos
      </UButton>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
      <UCard class="rounded-[1.5rem] border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20">
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
              Alertas de stock
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Productos que requieren decision rapida en sucursal.
            </p>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="alert in props.overview?.lowStock.slice(0, 6) ?? []"
            :key="`${alert.productId}:${alert.branchId}`"
            class="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p class="font-medium text-slate-950 dark:text-white">
                {{ alert.productName }}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{ alert.branchName }} - Disponible {{ alert.availableQuantity }} / Minimo {{ alert.minStockLevel }}
              </p>
            </div>
            <UButton color="warning" variant="soft" @click="emits('goToStockFromAlert', alert.productId)">
              Ajustar en stock
            </UButton>
          </div>

          <p v-if="(props.overview?.lowStock.length ?? 0) === 0" class="text-sm text-slate-500 dark:text-slate-400">
            No hay alertas activas de inventario.
          </p>
        </div>
      </UCard>

      <UCard class="rounded-[1.5rem] border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20">
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
              Ultimos movimientos
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Actividad reciente para seguimiento operativo.
            </p>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="movement in props.overview?.recentMovements ?? []"
            :key="movement.id"
            class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="font-medium text-slate-950 dark:text-white">
                {{ movement.productName }}
              </p>
              <UBadge :color="props.getMovementColor(movement.movementType)" variant="soft">
                {{ props.getMovementLabel(movement.movementType) }}
              </UBadge>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ movement.branchName }} - {{ movement.previousQuantity }} -> {{ movement.newQuantity }}
            </p>
            <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {{ props.formatDateTime(movement.createdAt) }}
            </p>
          </div>

          <p v-if="(props.overview?.recentMovements.length ?? 0) === 0" class="text-sm text-slate-500 dark:text-slate-400">
            No hubo movimientos registrados hoy.
          </p>
        </div>
      </UCard>
    </div>
  </UiSectionShell>
</template>
