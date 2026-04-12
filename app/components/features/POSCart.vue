<script setup lang="ts">
import type { POSBranchOption, POSCartItem } from "@/composables/usePOS";

const props = defineProps<{
  items: POSCartItem[];
  branches: POSBranchOption[];
  subtotal: number;
  loading?: boolean;
}>();

const emits = defineEmits<{
  "update-quantity": [{ id: string; quantity: number }];
  remove: [string];
  clear: [];
  checkout: [];
}>();

const branchNameMap = computed(() => new Map(props.branches.map((branch) => [branch.id, branch.name])));
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-950 dark:text-white">
            Carrito hibrido
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ items.length }} linea(s) activas entre productos y servicios.
          </p>
        </div>

        <UButton v-if="items.length > 0" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" @click="emits('clear')">
          Vaciar
        </UButton>
      </div>
    </template>

    <div v-if="items.length > 0" class="space-y-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-slate-950 dark:text-white">
              {{ item.name }}
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ branchNameMap.get(item.branchId) ?? "Sucursal" }}
            </p>
            <p v-if="item.itemType === 'product'" class="text-sm text-slate-500 dark:text-slate-400">
              {{ item.categoryName ?? "Producto" }}{{ item.sku ? ` · ${item.sku}` : "" }}
            </p>
            <p v-else class="text-sm text-slate-500 dark:text-slate-400">
              {{ item.employeeName }} · {{ item.scheduledDate }} {{ item.scheduledTime }}
            </p>
          </div>

          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-x" @click="emits('remove', item.id)">
            Quitar
          </UButton>
        </div>

        <div class="mt-4 flex items-center justify-between gap-3">
          <div v-if="item.itemType === 'product'" class="flex items-center gap-2">
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-minus" :disabled="item.quantity <= 1" @click="emits('update-quantity', { id: item.id, quantity: item.quantity - 1 })" />
            <span class="min-w-[2rem] text-center text-sm font-medium">{{ item.quantity }}</span>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-plus" @click="emits('update-quantity', { id: item.id, quantity: item.quantity + 1 })" />
          </div>
          <div v-else class="text-sm text-slate-500 dark:text-slate-400">
            Duracion {{ item.durationMinutes }} min
          </div>

          <div class="text-right">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Subtotal
            </p>
            <p class="font-semibold text-slate-950 dark:text-white">
              Bs {{ item.subtotal.toFixed(2) }}
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-[1.25rem] bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950">
        <div class="flex items-center justify-between">
          <span class="text-sm uppercase tracking-[0.18em] opacity-80">Subtotal</span>
          <span class="text-2xl font-semibold">Bs {{ subtotal.toFixed(2) }}</span>
        </div>
      </div>

      <UButton block color="primary" size="xl" icon="i-lucide-credit-card" :loading="loading" @click="emits('checkout')">
        Proceder al cobro
      </UButton>
    </div>

    <UiEmptySearchState
      v-else
      title="Carrito vacio"
      description="Agrega productos o servicios desde el panel izquierdo para empezar una venta."
      icon="i-lucide-shopping-cart"
    />
  </UCard>
</template>
