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

const options = computed(() => props.categories.filter((category) => category.type === props.type));

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

    <div class="space-y-2">
      <label for="category-parent" class="text-sm font-medium text-slate-700 dark:text-slate-300">Categoria padre</label>
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
        <select id="category-parent" v-model="state.parentId" name="parentId" class="w-full bg-transparent outline-none" :disabled="loading">
          <option :value="null">Sin categoria padre</option>
          <option v-for="category in options" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>
    </div>

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
