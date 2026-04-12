<script setup lang="ts">
import { z } from "zod";

import type {
  CatalogCategoryItem,
  CatalogProductPayload,
} from "@/composables/useCatalog";

interface ProductFormState {
  name: string;
  sku: string;
  description: string;
  imageUrl: string;
  imageFile: File | null;
  cropSquare: boolean;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
}

const props = withDefaults(defineProps<{
  loading?: boolean;
  categories: CatalogCategoryItem[];
  initialValue?: Partial<ProductFormState>;
  submitLabel?: string;
}>(), {
  loading: false,
  initialValue: () => ({}),
  submitLabel: "Guardar producto",
});

const emits = defineEmits<{
  submit: [CatalogProductPayload];
  cancel: [];
}>();

const state = reactive<ProductFormState>({
  name: "",
  sku: "",
  description: "",
  imageUrl: "",
  imageFile: null,
  cropSquare: false,
  costPrice: 0,
  salePrice: 0,
  categoryId: null,
  trackInventory: true,
});
const imageInputRef = ref<HTMLInputElement | null>(null);
const localPreviewUrl = ref<string | null>(null);
const previewUrl = computed(() => localPreviewUrl.value || state.imageUrl || null);

watch(
  () => props.initialValue,
  (value) => {
    state.name = value.name ?? "";
    state.sku = value.sku ?? "";
    state.description = value.description ?? "";
    state.imageUrl = value.imageUrl ?? "";
    state.imageFile = null;
    state.cropSquare = value.cropSquare ?? false;
    state.costPrice = value.costPrice ?? 0;
    state.salePrice = value.salePrice ?? 0;
    state.categoryId = value.categoryId ?? null;
    state.trackInventory = value.trackInventory ?? true;
  },
  { immediate: true, deep: true },
);

const schema = z.object({
  name: z.string().trim().min(3, "El nombre del producto es obligatorio."),
  sku: z.string().trim().max(64, "El SKU no puede superar 64 caracteres."),
  description: z.string().trim().max(240, "La descripcion no puede superar 240 caracteres."),
  imageUrl: z.string().trim().max(2048, "La ruta de imagen supera el maximo permitido."),
  cropSquare: z.boolean(),
  costPrice: z.coerce.number().min(0, "El costo no puede ser negativo."),
  salePrice: z.coerce.number().min(0, "El precio de venta no puede ser negativo."),
  categoryId: z.string().uuid().nullable(),
  trackInventory: z.boolean(),
}).superRefine((value, context) => {
  if (value.salePrice < value.costPrice) {
    context.addIssue({
      code: "custom",
      path: ["salePrice"],
      message: "El precio de venta no deberia ser menor al costo.",
    });
  }
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

  clearLocalPreview();
  state.imageFile = file;
  if (import.meta.client) {
    localPreviewUrl.value = URL.createObjectURL(file);
  }
};

const submit = () => {
  emits("submit", {
    name: state.name.trim(),
    sku: state.sku.trim(),
    description: state.description.trim(),
    imageUrl: state.imageUrl.trim() || null,
    imageFile: state.imageFile,
    cropSquare: state.cropSquare,
    costPrice: state.costPrice,
    salePrice: state.salePrice,
    categoryId: state.categoryId,
    trackInventory: state.trackInventory,
  });
};

onBeforeUnmount(() => {
  clearLocalPreview();
});
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField label="Nombre" name="name">
        <UInput v-model="state.name" placeholder="Ej. Shampoo Repair Pro" :disabled="loading" />
      </UFormField>

      <UFormField label="SKU" name="sku">
        <UInput v-model="state.sku" placeholder="SKU-001" :disabled="loading" />
      </UFormField>
    </div>

    <UFormField label="Descripcion" name="description">
      <UTextarea
        v-model="state.description"
        :rows="3"
        placeholder="Resumen corto para el equipo o el POS"
        :disabled="loading"
      />
    </UFormField>

    <UFormField label="Imagen del producto" name="imageUrl">
      <div class="space-y-3">
        <div
          v-if="previewUrl"
          class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
          :class="state.cropSquare ? 'mx-auto aspect-square max-w-52' : 'h-36 w-full'"
        >
          <img
            :src="previewUrl"
            :alt="state.name || 'Imagen de producto'"
            class="object-cover"
            :class="state.cropSquare ? 'h-full w-full' : 'h-36 w-full'"
          >
        </div>
        <input
          ref="imageInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-sky-950/50 dark:file:text-sky-200"
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
        <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input v-model="state.cropSquare" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500">
          Recortar a formato cuadrado (1:1)
        </label>
      </div>
    </UFormField>

    <div class="grid gap-4 md:grid-cols-2">
      <UFormField label="Precio costo" name="costPrice">
        <UInput v-model.number="state.costPrice" type="number" min="0" step="0.01" :disabled="loading" />
      </UFormField>

      <UFormField label="Precio venta" name="salePrice">
        <UInput v-model.number="state.salePrice" type="number" min="0" step="0.01" :disabled="loading" />
      </UFormField>
    </div>

    <div class="space-y-2">
      <label for="product-category" class="text-sm font-medium text-slate-700 dark:text-slate-300">Categoria</label>
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
        <select id="product-category" v-model="state.categoryId" name="categoryId" class="w-full bg-transparent outline-none" :disabled="loading">
          <option :value="null">Sin categoria</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>
    </div>

    <UFormField name="trackInventory">
      <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-medium text-slate-950 dark:text-white">
              Controlar inventario
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Desactiva esta opcion si el producto no debe descontar stock ni mostrar alertas.
            </p>
          </div>

          <USwitch v-model="state.trackInventory" :disabled="loading" />
        </div>
      </div>
    </UFormField>

    <div class="flex justify-end gap-3 pt-2">
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ submitLabel }}
      </UButton>
    </div>
  </UForm>
</template>
