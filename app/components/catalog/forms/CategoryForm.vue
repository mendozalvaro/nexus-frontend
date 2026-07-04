<script setup lang="ts">
import { z } from "zod";

import type {
  CatalogCategoryItem,
  CatalogCategoryPayload,
} from "@/composables/useCatalog";
import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface CategoryFormState {
  name: string;
  parentId: string | null;
  description: string;
  type: "product" | "service" | "lodging";
}

const props = withDefaults(defineProps<{
  loading?: boolean;
  type: "product" | "service" | "lodging";
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
  description: "",
  type: props.type,
});

watch(
  () => props.initialValue,
  (value) => {
    state.name = value.name ?? "";
    state.parentId = value.parentId ?? null;
    state.description = (value as Record<string, unknown>).description as string ?? "";
    state.type = props.type;
  },
  { immediate: true, deep: true },
);

watch(() => props.type, (type) => {
  state.type = type;
});

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
  type: z.enum(["product", "service", "lodging"]),
  description: z.string().trim().max(240, "La descripcion no puede superar 240 caracteres.").optional(),
});

const submit = () => {
  emits("submit", {
    name: state.name.trim(),
    parentId: state.parentId,
    type: props.type,
    description: state.description || undefined,
  });
};
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-6" @submit="submit">
    <AdminFormSection
      title="Datos de la categoria"
      description="Estructura del catalogo."
      :columns="1"
    >
      <AdminFieldGroup :columns="1">
        <UFormField label="Tipo" name="type">
          <UInput :model-value="state.type === 'product' ? 'Producto' : state.type === 'service' ? 'Servicio' : 'Alojamiento'" disabled class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Nombre" name="name">
          <UInput v-model="state.name" placeholder="Ej. Capilares" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Descripcion" name="description">
          <UTextarea v-model="state.description" placeholder="Describe la categoria" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
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
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <AdminFormActions>
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ submitLabel }}
      </UButton>
    </AdminFormActions>
  </UForm>
</template>
