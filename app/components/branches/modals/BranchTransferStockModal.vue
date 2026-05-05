<script setup lang="ts">
import { z } from "zod";

import type { BranchInventoryItem, BranchOption, BranchTransferPayload } from "@/composables/useBranches";

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranches: BranchOption[];
  inventoryItems: BranchInventoryItem[];
  upgradeMessage?: string | null;
}>(), {
  loading: false,
  upgradeMessage: null,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [BranchTransferPayload];
}>();

interface TransferFormState {
  destinationBranchId: string;
  productId: string;
  quantity: number;
  note: string;
}

const state = reactive<TransferFormState>({
  destinationBranchId: "",
  productId: "",
  quantity: 1,
  note: "",
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.destinationBranchId = props.destinationBranches[0]?.value ?? "";
    state.productId = props.inventoryItems.find((item) => item.availableQuantity > 0)?.productId ?? "";
    state.quantity = 1;
    state.note = "";
  },
  { immediate: true },
);

const selectedInventory = computed(() => {
  return props.inventoryItems.find((item) => item.productId === state.productId) ?? null;
});

const schema = computed(() =>
  z.object({
    destinationBranchId: z.string().uuid("Selecciona una sucursal destino valida."),
    productId: z.string().uuid("Selecciona un producto valido."),
    quantity: z.number().int("Ingresa una cantidad entera.").positive("La cantidad debe ser mayor a cero."),
    note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional(),
  }).superRefine((value, context) => {
    if (!selectedInventory.value) {
      context.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Selecciona un producto disponible para transferir.",
      });
      return;
    }

    if (value.quantity > selectedInventory.value.availableQuantity) {
      context.addIssue({
        code: "custom",
        path: ["quantity"],
        message: `Solo hay ${selectedInventory.value.availableQuantity} unidad(es) disponibles en la sucursal origen.`,
      });
    }
  }),
);

const submit = () => {
  if (!state.destinationBranchId || !state.productId) {
    return;
  }

  emits("submit", {
    sourceBranchId: props.sourceBranchId,
    destinationBranchId: state.destinationBranchId,
    productId: state.productId,
    quantity: state.quantity,
    note: state.note,
  });
};
</script>

<template>
  <UModal
    :open="open"
    title="Transferir stock"
    :description="`Mueve inventario disponible desde ${sourceBranchName} hacia otra sucursal activa.`"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="upgradeMessage"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Feature no disponible"
          :description="upgradeMessage"
        />

        <UForm :schema="schema" :state="state" class="space-y-4 md:space-y-5" @submit="submit">
          <UFormField label="Sucursal destino" name="destinationBranchId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.destinationBranchId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading || Boolean(upgradeMessage)">
                <option value="">Selecciona una sucursal</option>
                <option v-for="branch in destinationBranches" :key="branch.value" :value="branch.value">
                  {{ branch.label }}
                </option>
              </select>
            </div>
          </UFormField>

          <UFormField label="Producto" name="productId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.productId" class="min-h-10 w-full bg-transparent text-sm outline-none" :disabled="loading || Boolean(upgradeMessage)">
                <option value="">Selecciona un producto</option>
                <option
                  v-for="item in inventoryItems"
                  :key="item.productId"
                  :value="item.productId"
                  :disabled="item.availableQuantity <= 0"
                >
                  {{ item.productName }}{{ item.sku ? ` (${item.sku})` : "" }} · Disponible: {{ item.availableQuantity }}
                </option>
              </select>
            </div>
          </UFormField>

          <UFormField label="Cantidad" name="quantity">
            <UInput
              v-model.number="state.quantity"
              type="number"
              min="1"
              :max="selectedInventory?.availableQuantity ?? 1"
              :disabled="loading || Boolean(upgradeMessage)"
              :ui="{ base: 'min-h-11 text-base' }"
            />
          </UFormField>

          <UFormField label="Nota interna" name="note">
            <UTextarea
              v-model="state.note"
              :rows="3"
              placeholder="Opcional: motivo o referencia de la transferencia"
              :disabled="loading || Boolean(upgradeMessage)"
              :ui="{ base: 'text-base' }"
            />
          </UFormField>

          <div
            v-if="selectedInventory"
            class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
          >
            <p class="font-medium text-slate-950 dark:text-white">
              {{ selectedInventory.productName }}
            </p>
            <p class="mt-1">
              Stock total: {{ selectedInventory.quantity }} · Reservado: {{ selectedInventory.reservedQuantity }} · Disponible: {{ selectedInventory.availableQuantity }}
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
