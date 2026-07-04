<script setup lang="ts">
import type { POSCustomerOption } from "@/composables/usePOS";
import type { POSBranchOption, POSCartItem } from "@/composables/usePOS";

const props = defineProps<{
  items: POSCartItem[];
  branches: POSBranchOption[];
  subtotal: number;
  loading?: boolean;
  note?: string;
  editing?: boolean;
  customerMode: "existing" | "walk_in";
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerOptions: POSCustomerOption[];
  anonymousLabel?: string;
}>();

const emits = defineEmits<{
  "update-quantity": [{ id: string; quantity: number }];
  remove: [string];
  clear: [];
  "update-customer-mode": ["existing" | "walk_in"];
  "update-customer-existing": [string];
  "search-customers": [string];
  "update-note": [string];
  "submit-sale": [];
  "submit-proforma": [];
  "create-customer": [];
}>();

const branchNameMap = computed(() => new Map(props.branches.map((branch) => [branch.id, branch.name])));
const customerQuery = ref("");

watch(customerQuery, (value) => {
  emits("search-customers", value);
});

const customerItems = computed(() => {
  const items = props.customerOptions.map((customer) => ({
    label: `${customer.fullName}${customer.phone ? ` · ${customer.phone}` : ""}`,
    value: customer.id,
  }));

  if (
    props.customerMode === "existing"
    && props.customerId
    && props.customerName.trim().length > 0
    && !items.some((item) => item.value === props.customerId)
  ) {
    items.unshift({
      label: `${props.customerName}${props.customerPhone ? ` · ${props.customerPhone}` : ""}`,
      value: props.customerId,
    });
  }

  return items;
});
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-950 dark:text-white">
            Carrito
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ items.length }} item(s) listos para registrar.
          </p>
        </div>

        <UButton v-if="items.length > 0" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" @click="emits('clear')">
          Vaciar
        </UButton>
      </div>
    </template>

    <div v-if="items.length > 0" class="space-y-4">
      <div class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <UButton
              :color="customerMode === 'walk_in' ? 'primary' : 'neutral'"
              :variant="customerMode === 'walk_in' ? 'solid' : 'soft'"
              size="sm"
              @click="emits('update-customer-mode', 'walk_in')"
            >
              Cliente anónimo
            </UButton>
            <UButton
              :color="customerMode === 'existing' ? 'primary' : 'neutral'"
              :variant="customerMode === 'existing' ? 'solid' : 'soft'"
              size="sm"
              @click="emits('update-customer-mode', 'existing')"
            >
              Cliente existente
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-user-plus"
              @click="emits('create-customer')"
            >
              Nuevo cliente
            </UButton>
          </div>

          <template v-if="customerMode === 'existing'">
            <UInput
              v-model="customerQuery"
              icon="i-lucide-search"
              placeholder="Buscar cliente"
              :disabled="loading"
            />
            <USelect
              :model-value="customerId"
              :items="customerItems"
              label-key="label"
              value-key="value"
              placeholder="Selecciona un cliente"
              :disabled="loading"
              @update:model-value="emits('update-customer-existing', String($event ?? ''))"
            />
          </template>

          <div v-else class="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
            Se registrará la venta con el cliente anónimo:
            <span class="font-medium text-slate-950 dark:text-white">{{ anonymousLabel ?? "Cliente anónimo" }}</span>.
          </div>
        </div>
      </div>

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

      <div class="space-y-2">
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Nota</label>
        <UTextarea
          :model-value="note ?? ''"
          :rows="3"
          placeholder="Nota comercial u observacion"
          :disabled="loading"
          @update:model-value="emits('update-note', String($event ?? ''))"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UButton color="primary" class="min-h-11 justify-center" :loading="loading" @click="emits('submit-sale')">
          {{ editing ? "Actualizar venta" : "Registrar venta" }}
        </UButton>
        <UButton color="neutral" variant="soft" class="min-h-11 justify-center" :loading="loading" @click="emits('submit-proforma')">
          {{ editing ? "Actualizar + proforma" : "Registrar proforma" }}
        </UButton>
      </div>
    </div>

    <UiEmptySearchState
      v-else
      title="Carrito vacio"
      description="Agrega productos o servicios desde el panel izquierdo para empezar una venta."
      icon="i-lucide-shopping-cart"
    />
  </UCard>
</template>
