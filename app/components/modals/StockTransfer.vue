<script setup lang="ts">
import { z } from "zod";

import type {
  InventoryBranchOption,
  InventoryProductRowView,
  InventoryTransferPayload,
} from "@/composables/useInventory";

interface TransferFormState {
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  quantity: number;
  reason: string;
  note: string;
}

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  selectedProductId?: string | null;
  selectedBranchId?: string | null;
  upgradeMessage?: string | null;
}>(), {
  loading: false,
  selectedProductId: null,
  selectedBranchId: null,
  upgradeMessage: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [InventoryTransferPayload];
}>();

const state = reactive<TransferFormState>({
  sourceBranchId: "",
  destinationBranchId: "",
  productId: "",
  quantity: 1,
  reason: "",
  note: "",
});

const availableDestinations = computed(() => {
  return props.branches.filter((branch) => branch.id !== state.sourceBranchId && branch.isActive);
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.sourceBranchId = props.selectedBranchId ?? props.branches.find((branch) => branch.isActive)?.id ?? "";
    state.destinationBranchId = availableDestinations.value[0]?.id ?? "";
    state.productId = props.selectedProductId ?? props.products.find((product) => product.totalAvailableQuantity > 0)?.id ?? "";
    state.quantity = 1;
    state.reason = "";
    state.note = "";
  },
  { immediate: true },
);

watch(
  () => state.sourceBranchId,
  () => {
    if (state.destinationBranchId === state.sourceBranchId) {
      state.destinationBranchId = availableDestinations.value[0]?.id ?? "";
    }
  },
);

const selectedProduct = computed(() => {
  return props.products.find((product) => product.id === state.productId) ?? null;
});

const sourceStock = computed(() => {
  return selectedProduct.value?.stockByBranch.find((item) => item.branchId === state.sourceBranchId) ?? null;
});

const schema = computed(() => z.object({
  sourceBranchId: z.string().uuid("Selecciona la sucursal origen."),
  destinationBranchId: z.string().uuid("Selecciona la sucursal destino."),
  productId: z.string().uuid("Selecciona un producto valido."),
  quantity: z.coerce.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
  reason: z.string().trim().min(3, "Debes indicar el motivo de la transferencia."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres."),
}).superRefine((value, context) => {
  if (value.sourceBranchId === value.destinationBranchId) {
    context.addIssue({
      code: "custom",
      path: ["destinationBranchId"],
      message: "La sucursal destino debe ser distinta a la origen.",
    });
  }

  if (!sourceStock.value) {
    context.addIssue({
      code: "custom",
      path: ["productId"],
      message: "El producto no tiene stock en la sucursal origen.",
    });
    return;
  }

  if (value.quantity > sourceStock.value.availableQuantity) {
    context.addIssue({
      code: "custom",
      path: ["quantity"],
      message: `Solo hay ${sourceStock.value.availableQuantity} unidad(es) disponibles para transferir.`,
    });
  }
}));

const submit = () => {
  emits("submit", {
    sourceBranchId: state.sourceBranchId,
    destinationBranchId: state.destinationBranchId,
    productId: state.productId,
    quantity: state.quantity,
    reason: state.reason.trim(),
    note: state.note.trim(),
  });
};
</script>

<template>
  <UModal
    :open="open"
    title="Transferir stock"
    description="Genera salida en la sucursal origen y entrada en la sucursal destino, con auditoria completa."
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="upgradeMessage"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Transferencias no disponibles"
          :description="upgradeMessage"
        />

        <UForm :schema="schema" :state="state" class="space-y-4 md:space-y-5" @submit="submit">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Sucursal origen" name="sourceBranchId">
              <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                <select v-model="state.sourceBranchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading || Boolean(upgradeMessage)">
                  <option value="">Selecciona una sucursal</option>
                  <option v-for="branch in branches.filter((item) => item.isActive)" :key="branch.id" :value="branch.id">
                    {{ branch.name }} ({{ branch.code }})
                  </option>
                </select>
              </div>
            </UFormField>

            <UFormField label="Sucursal destino" name="destinationBranchId">
              <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                <select v-model="state.destinationBranchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading || Boolean(upgradeMessage)">
                  <option value="">Selecciona una sucursal</option>
                  <option v-for="branch in availableDestinations" :key="branch.id" :value="branch.id">
                    {{ branch.name }} ({{ branch.code }})
                  </option>
                </select>
              </div>
            </UFormField>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Producto" name="productId">
              <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                <select v-model="state.productId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading || Boolean(upgradeMessage)">
                  <option value="">Selecciona un producto</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.name }}{{ product.sku ? ` (${product.sku})` : "" }}
                  </option>
                </select>
              </div>
            </UFormField>

            <UFormField label="Cantidad" name="quantity">
              <UInput v-model.number="state.quantity" type="number" min="1" :disabled="loading || Boolean(upgradeMessage)" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Motivo" name="reason">
              <UInput v-model="state.reason" placeholder="Ej. rebalanceo semanal" :disabled="loading || Boolean(upgradeMessage)" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField label="Nota interna" name="note">
              <UInput v-model="state.note" placeholder="Opcional" :disabled="loading || Boolean(upgradeMessage)" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>

          <div
            v-if="selectedProduct"
            class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
          >
            <p class="font-medium text-slate-950 dark:text-white">
              {{ selectedProduct.name }}
            </p>
            <p class="mt-1">
              Disponible en origen: {{ sourceStock?.availableQuantity ?? 0 }} · Total origen: {{ sourceStock?.quantity ?? 0 }}
            </p>
          </div>

          <UiResponsiveModalActions>
            <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('update:open', false)">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" icon="i-lucide-send" block class="min-h-11 sm:w-auto" :loading="loading" :disabled="Boolean(upgradeMessage)">
              Confirmar transferencia
            </UButton>
          </UiResponsiveModalActions>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
