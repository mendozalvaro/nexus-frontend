<script setup lang="ts">
import { z } from "zod";

import type {
  CatalogCategoryItem,
  CatalogServicePayload,
} from "@/composables/useCatalog";
import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface ServiceFormState {
  name: string;
  description: string;
  imageUrl: string;
  imageFile: File | null;
  cropSquare: boolean;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
}

const props = withDefaults(defineProps<{
  loading?: boolean;
  categories: CatalogCategoryItem[];
  initialValue?: Partial<ServiceFormState>;
  submitLabel?: string;
}>(), {
  loading: false,
  initialValue: () => ({}),
  submitLabel: "Guardar servicio",
});

const emits = defineEmits<{
  submit: [CatalogServicePayload];
  cancel: [];
}>();

const state = reactive<ServiceFormState>({
  name: "",
  description: "",
  imageUrl: "",
  imageFile: null,
  cropSquare: false,
  price: 0,
  durationMinutes: 30,
  categoryId: null,
});
const imageInputRef = ref<HTMLInputElement | null>(null);
const localPreviewUrl = ref<string | null>(null);
const previewUrl = computed(() => localPreviewUrl.value || state.imageUrl || null);
const imageError = ref<string | null>(null);
const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

watch(
  () => props.initialValue,
  (value) => {
    state.name = value.name ?? "";
    state.description = value.description ?? "";
    state.imageUrl = value.imageUrl ?? "";
    state.imageFile = null;
    state.cropSquare = value.cropSquare ?? false;
    state.price = value.price ?? 0;
    state.durationMinutes = value.durationMinutes ?? 30;
    state.categoryId = value.categoryId ?? null;
    imageError.value = null;
  },
  { immediate: true, deep: true },
);

const schema = z.object({
  name: z.string().trim().min(3, "El nombre del servicio es obligatorio."),
  description: z.string().trim().max(240, "La descripcion no puede superar 240 caracteres."),
  imageUrl: z.string().trim().max(2048, "La ruta de imagen supera el maximo permitido."),
  cropSquare: z.boolean(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  durationMinutes: z.coerce.number().int("La duracion debe ser entera.").min(5, "La duracion minima es de 5 minutos."),
  categoryId: z.string().uuid().nullable(),
});

const clearLocalPreview = () => {
  if (localPreviewUrl.value && import.meta.client) {
    URL.revokeObjectURL(localPreviewUrl.value);
  }
  localPreviewUrl.value = null;
};

const clearImageSelection = () => {
  clearLocalPreview();
  state.imageFile = null;
  state.imageUrl = "";
  imageError.value = null;
  if (imageInputRef.value) {
    imageInputRef.value.value = "";
  }
};

const handleImageSelection = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    imageError.value = "La imagen debe ser PNG, JPG o WebP.";
    input.value = "";
    return;
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    imageError.value = "La imagen no puede superar 2MB.";
    input.value = "";
    return;
  }

  clearLocalPreview();
  imageError.value = null;
  state.imageFile = file;
  if (import.meta.client) {
    localPreviewUrl.value = URL.createObjectURL(file);
  }
};

const submit = () => {
  emits("submit", {
    name: state.name.trim(),
    description: state.description.trim(),
    imageUrl: state.imageUrl.trim() || null,
    imageFile: state.imageFile,
    cropSquare: state.cropSquare,
    price: state.price,
    durationMinutes: state.durationMinutes,
    categoryId: state.categoryId,
  });
};

const categoryOptions = computed(() => [
  { label: "Sin categoria", value: "__none__" },
  ...props.categories.map((c) => ({ label: c.name, value: c.id })),
]);

const categoryModel = computed({
  get: () => state.categoryId ?? "__none__",
  set: (value) => { state.categoryId = value === "__none__" ? null : value; },
});

onBeforeUnmount(() => {
  clearLocalPreview();
});
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-6" @submit="submit">
    <AdminFormSection
      title="Informacion general"
      description="Datos comerciales del servicio."
      :columns="1"
    >
      <AdminFieldGroup :columns="2">
        <UFormField label="Nombre" name="name" class="sm:col-span-2">
          <UInput v-model="state.name" placeholder="Ej. Corte clasico" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Descripcion" name="description" class="sm:col-span-2">
          <UTextarea
            v-model="state.description"
            :rows="4"
            placeholder="Resumen corto para agenda y equipo"
            :disabled="loading"
            class="w-full"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Precio" name="price">
          <UInput v-model.number="state.price" type="number" min="0" step="0.01" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Duracion (min)" name="durationMinutes">
          <UInput v-model.number="state.durationMinutes" type="number" min="5" step="5" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <AdminFormSection
      title="Imagen y categorizacion"
      description="Aspecto visual y clasificacion en el catalogo."
      :columns="1"
    >
      <AdminFieldGroup :columns="1">
        <UFormField label="Imagen del servicio" name="imageUrl">
          <div class="space-y-3">
            <div
              v-if="previewUrl"
              class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
              :class="state.cropSquare ? 'mx-auto aspect-square max-w-52' : 'h-36 w-full'"
            >
              <img
                :src="previewUrl"
                :alt="state.name || 'Imagen de servicio'"
                class="object-cover"
                :class="state.cropSquare ? 'h-full w-full' : 'h-36 w-full'"
              >
            </div>
            <input
              ref="imageInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-violet-950/50 dark:file:text-violet-200"
              :disabled="loading"
              @change="handleImageSelection"
            >
            <div class="flex items-center justify-between">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                JPG, PNG o WebP. Maximo 2MB.
              </p>
              <UButton v-if="previewUrl" type="button" size="xs" color="neutral" variant="ghost" :disabled="loading" @click="clearImageSelection">
                Quitar imagen
              </UButton>
            </div>
            <p v-if="imageError" class="text-xs text-rose-600 dark:text-rose-400">
              {{ imageError }}
            </p>
            <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input v-model="state.cropSquare" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500">
              Recortar a formato cuadrado (1:1)
            </label>
          </div>
        </UFormField>

        <UFormField label="Categoria" name="categoryId">
          <USelect
            v-model="categoryModel"
            :items="categoryOptions"
            label-key="label"
            value-key="value"
            placeholder="Sin categoria"
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
