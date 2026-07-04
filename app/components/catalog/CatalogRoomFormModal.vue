<script setup lang="ts">
import type { CatalogRoomItem, CatalogRoomPayload, CatalogCategoryItem } from "@/composables/useCatalog";
import type { BranchOption } from "@/composables/useBranches";

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  initialValue?: CatalogRoomItem | null;
  lodgingCategories: CatalogCategoryItem[];
  branches: BranchOption[];
}>(), { initialValue: null });

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [payload: CatalogRoomPayload];
}>();

const defaultState = (): CatalogRoomPayload => ({
  roomNumber: "",
  floor: undefined,
  categoryId: "",
  branchId: "",
  basePrice: 0,
  notes: "",
});

const state = reactive<CatalogRoomPayload>(defaultState());

const isEdit = computed(() => !!props.initialValue);
const categoryOptions = computed(() => props.lodgingCategories.map((c) => ({ label: c.name, value: c.id })));

watch(() => props.open, (open) => {
  if (open && props.initialValue) {
    Object.assign(state, {
      roomNumber: props.initialValue.roomNumber,
      floor: props.initialValue.floor,
      categoryId: props.initialValue.categoryId,
      branchId: props.initialValue.branchId,
      basePrice: props.initialValue.basePrice,
      notes: props.initialValue.notes ?? "",
    });
  } else if (open) {
    Object.assign(state, defaultState());
  }
});

const handleSubmit = () => {
  emit("submit", { ...state });
};
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #title>
      {{ isEdit ? "Editar" : "Nueva" }} habitacion
    </template>

    <template #body>
      <UForm :state="state" @submit="handleSubmit" class="space-y-4">
        <UFormField label="Numero de habitacion" required>
          <UInput v-model="state.roomNumber" placeholder="Ej: 101" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Piso">
            <UInput v-model="state.floor" type="number" min="0" class="w-full" />
          </UFormField>

          <UFormField label="Categoria (tipo de habitacion)" required>
            <USelectMenu
              v-model="state.categoryId"
              :items="categoryOptions"
              value-key="value"
              label-key="label"
              placeholder="Seleccionar tipo..."
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Precio fijo por noche" required>
          <UInput v-model.number="state.basePrice" type="number" min="0" step="0.01" class="w-full" />
        </UFormField>

        <UFormField label="Sucursal" required>
          <USelectMenu
            v-model="state.branchId"
            :items="branches"
            value-key="value"
            label-key="label"
            placeholder="Seleccionar sucursal..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Notas">
          <UTextarea v-model="state.notes" placeholder="Notas opcionales" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">Cancelar</UButton>
          <UButton type="submit" :loading="loading">
            {{ isEdit ? "Guardar" : "Crear" }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
