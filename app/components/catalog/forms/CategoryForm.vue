<script setup lang="ts">
import { z } from "zod";

import type {
  CatalogCategoryItem,
  CatalogCategoryPayload,
} from "@/composables/useCatalog";

interface CategoryFormState {
  name: string;
  parentId: string | null;
}

const props = withDefaults(defineProps<{
  loading?: boolean;
  type: "product" | "service";
  categories: CatalogCategoryItem[];
  initialValue?: Partial<CategoryFormState>;
  submitLabel?: string;
}>(), {
  loading: false,
  initialValue: () => ({}),
  submitLabel: "Guardar categoria",
});

const emits = defineEmits<{
  submit: [CatalogCategoryPayload];
  cancel: [];
}>();

const state = reactive<CategoryFormState>({
  name: "",
  parentId: null,
});

watch(
  () => props.initialValue,
  (value) => {
    state.name = value.name ?? "";
    state.parentId = value.parentId ?? null;
  },
  { immediate: true, deep: true },
);

const options = computed(() => {
    const filtered = props.categories.filter((category) => category.type === props.type);
    return [
      { label: "Sin categoria padre", value: "__none__" },
      ...filtered.map((category) => ({
        label: category.name,
        value: category.id,
      })),
    ];
  });

const parentModel = computed({
  get: () => state.parentId ?? "__none__",
  set: (value) => { state.parentId = value === "__none__" ? null : value; },
});

const schema = z.object({
  name: z.string().trim().min(2, "El nombre de la categoria es obligatorio."),
  parentId: z.string().uuid().nullable(),
});

const submit = () => {
  emits("submit", {
    name: state.name.trim(),
    parentId: state.parentId,
    type: props.type,
  });
};
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
    <UFormField label="Nombre" name="name">
      <UInput v-model="state.name" placeholder="Ej. Capilares" :disabled="loading" />
    </UFormField>

    <UFormField label="Categoria padre" name="parentId">
        <USelect
          v-model="parentModel"
          :items="options"
          label-key="label"
          value-key="value"
          placeholder="Sin categoria padre"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

    <UiResponsiveModalActions>
      <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" block class="min-h-11 sm:w-auto" :loading="loading">
        {{ submitLabel }}
      </UButton>
    </UiResponsiveModalActions>
  </UForm>
</template>
