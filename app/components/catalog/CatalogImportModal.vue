<script setup lang="ts">
import type { ImportEntityType } from "@/composables/useCatalogImport";

const props = defineProps<{
  entityType: ImportEntityType;
  duplicateStrategy: "upsert" | "skip";
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  "update:entityType": [value: ImportEntityType];
  "update:duplicateStrategy": [value: "upsert" | "skip"];
  "file-selected": [file: File];
  "download-template": [];
}>();

const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement>();

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    emit("file-selected", files[0]!);
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleFileInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    emit("file-selected", files[0]!);
  }
  target.value = "";
};

const entityLabels: Record<ImportEntityType, string> = {
  categories: "Categorias",
  products: "Productos",
  services: "Servicios",
};

const entityTypeOptions = [
  { label: "Productos", value: "products" },
  { label: "Servicios", value: "services" },
  { label: "Categorias", value: "categories" },
];

const onEntityTypeChange = (val: unknown) => {
  const v = val as { value: ImportEntityType } | null;
  if (v?.value) {
    emit("update:entityType", v.value);
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de datos a importar</label>
      <USelectMenu
        :model-value="{ label: entityLabels[entityType], value: entityType }"
        :items="entityTypeOptions"
        value-attribute="value"
        option-attribute="label"
        placeholder="Selecciona un tipo"
        @update:model-value="onEntityTypeChange"
      />
    </div>

    <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Plantilla Excel</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">Descarga una plantilla con el formato correcto para {{ entityLabels[entityType] }}.</p>
      </div>
      <UButton variant="outline" color="primary" size="sm" icon="i-lucide-download" @click="emit('download-template')">
        Descargar plantilla
      </UButton>
    </div>

    <div
      class="relative rounded-xl border-2 border-dashed p-8 text-center transition-colors"
      :class="isDragging ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-300 dark:border-slate-600'"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleFileInput" />

      <UIcon name="i-lucide-upload-cloud" class="mx-auto h-10 w-10 text-slate-400" />
      <p class="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
        Arrastra tu archivo Excel aqui
      </p>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        o
        <button type="button" class="text-sky-600 hover:text-sky-700 dark:text-sky-400" @click="fileInputRef?.click()">
          selecciona un archivo
        </button>
      </p>
      <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">.xlsx, .xls</p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="error"
    />
  </div>
</template>
