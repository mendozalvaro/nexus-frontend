<script setup lang="ts">
import { z } from "zod";
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
  location: "",
  categoryId: "",
  branchId: "",
  basePrice: 0,
  notes: "",
});

const state = reactive<CatalogRoomPayload>(defaultState());
const schema = z.object({
  roomNumber: z.string().trim().min(1, "El numero de habitacion es obligatorio."),
  location: z.string().trim().max(120, "La ubicacion no puede superar 120 caracteres.").optional(),
  categoryId: z.string().uuid("Selecciona una categoria valida."),
  branchId: z.string().uuid("Selecciona una sucursal valida."),
  basePrice: z.coerce.number().min(0.01, "El precio fijo debe ser mayor a cero."),
  notes: z.string().trim().max(500, "Las notas no pueden superar 500 caracteres.").optional(),
});

const isEdit = computed(() => !!props.initialValue);
const categoryOptions = computed(() => props.lodgingCategories.map((c) => ({ label: c.name, value: c.id })));

watch(() => props.open, (open) => {
  if (open && props.initialValue) {
    Object.assign(state, {
      roomNumber: props.initialValue.roomNumber,
      location: props.initialValue.location ?? "",
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
      <UForm :schema="schema" :state="state" @submit="handleSubmit" class="space-y-4">
        <UFormField label="Numero de habitacion" name="roomNumber" required>
          <UInput v-model="state.roomNumber" placeholder="Ej: 101" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Ubicacion" name="location">
            <UInput v-model="state.location" placeholder="Ej: Piso 2, Ala norte" class="w-full" />
          </UFormField>

          <UFormField label="Categoria (tipo de habitacion)" name="categoryId" required>
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

        <UFormField label="Precio fijo por noche" name="basePrice" required>
          <UInput v-model.number="state.basePrice" type="number" min="0" step="0.01" class="w-full" />
        </UFormField>

        <UFormField label="Sucursal" name="branchId" required>
          <USelectMenu
            v-model="state.branchId"
            :items="branches"
            value-key="value"
            label-key="label"
            placeholder="Seleccionar sucursal..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Notas" name="notes">
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
