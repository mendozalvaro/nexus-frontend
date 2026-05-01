<script setup lang="ts">
import InventoryMovementTable from "@/components/features/InventoryMovementTable.vue";
import type { InventoryHistoryData, InventoryMovementRowView } from "@/composables/useInventory";

type OptionItem = {
  label: string;
  value: string;
};

const props = defineProps<{
  movementState: InventoryHistoryData | null;
  movementsPending: boolean;
  movementBranchModel: string;
  movementProductModel: string;
  movementType: string;
  movementDateFrom: string;
  movementDateTo: string;
  movementBranchOptions: OptionItem[];
  movementProductOptions: OptionItem[];
  movementTypeOptions: OptionItem[];
  formatDateTime: (value: string | null) => string;
  getMovementLabel: (value: InventoryMovementRowView["movementType"]) => string;
  getMovementColor: (value: InventoryMovementRowView["movementType"]) => "success" | "warning" | "error" | "primary" | "neutral";
}>();

const emits = defineEmits<{
  "update:movementBranchModel": [string];
  "update:movementProductModel": [string];
  "update:movementType": [string];
  "update:movementDateFrom": [string];
  "update:movementDateTo": [string];
  viewDetails: [InventoryMovementRowView];
}>();

const branchModel = computed({
  get: () => props.movementBranchModel,
  set: (value: string) => emits("update:movementBranchModel", value),
});

const productModel = computed({
  get: () => props.movementProductModel,
  set: (value: string) => emits("update:movementProductModel", value),
});

const typeModel = computed({
  get: () => props.movementType,
  set: (value: string) => emits("update:movementType", value),
});

const dateFromModel = computed({
  get: () => props.movementDateFrom,
  set: (value: string) => emits("update:movementDateFrom", value),
});

const dateToModel = computed({
  get: () => props.movementDateTo,
  set: (value: string) => emits("update:movementDateTo", value),
});
</script>

<template>
  <UiSectionShell
    eyebrow="Movimientos"
    title="Historial operativo"
    description="Consulta todos los movimientos con filtros y detalle por registro."
  >
    <UiSearchFilters title="Filtros" description="Filtra por sucursal, producto, tipo y rango de fecha." surface>
      <template #controls>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <USelect
            v-model="branchModel"
            :items="props.movementBranchOptions"
            label-key="label"
            value-key="value"
            class="w-full"
          />
          <USelect
            v-model="productModel"
            :items="props.movementProductOptions"
            label-key="label"
            value-key="value"
            searchable
            class="w-full"
          />
          <USelect
            v-model="typeModel"
            :items="props.movementTypeOptions"
            label-key="label"
            value-key="value"
            class="w-full"
          />
          <UInput v-model="dateFromModel" type="date" :ui="{ base: 'min-h-11 text-base' }" />
          <UInput v-model="dateToModel" type="date" :ui="{ base: 'min-h-11 text-base' }" />
        </div>
      </template>
      <template #summary>
        {{ props.movementState?.movements.length ?? 0 }} movimiento(s)
      </template>
    </UiSearchFilters>

    <InventoryMovementTable
      :rows="props.movementState?.movements ?? []"
      :loading="props.movementsPending"
      :format-date-time="props.formatDateTime"
      :get-movement-label="props.getMovementLabel"
      :get-movement-color="props.getMovementColor"
      @view-details="emits('viewDetails', $event)"
    />
  </UiSectionShell>
</template>
