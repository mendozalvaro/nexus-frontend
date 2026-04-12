<script setup lang="ts">
const props = defineProps<{
  previewUrl?: string | null;
  fileName?: string | null;
  error?: string | null;
}>();

const emit = defineEmits<{
  select: [file: File];
  clear: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const dragActive = ref(false);

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

const pickFile = () => {
  fileInput.value?.click();
};

const handleFile = (file: File | null | undefined) => {
  if (!file) {
    return;
  }

  emit("select", file);
};

const onInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  handleFile(input?.files?.[0]);
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  dragActive.value = false;
  handleFile(event.dataTransfer?.files?.[0]);
};
</script>

<template>
  <div class="space-y-3">
    <div
      class="rounded-[1.5rem] border border-dashed p-5 transition"
      :class="dragActive ? 'border-primary-400 bg-primary-50/70 dark:border-primary-500 dark:bg-primary-500/10' : 'border-slate-300/80 dark:border-slate-700'"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop="onDrop"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <img
              v-if="previewUrl"
              :src="previewUrl"
              alt="Vista previa del logo"
              class="h-14 w-14 rounded-2xl object-cover"
            >
            <UIcon v-else name="i-lucide-image-plus" class="h-6 w-6 text-slate-500 dark:text-slate-300" />
          </div>

          <div>
            <p class="text-sm font-semibold text-slate-950 dark:text-white">Logo de la organizacion</p>
            <p class="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
              Opcional. JPG, PNG o WebP de hasta 2MB.
            </p>
            <p v-if="fileName" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Seleccionado: {{ fileName }}
            </p>
          </div>
        </div>

        <div class="flex gap-2">
          <UButton color="neutral" variant="soft" @click="pickFile">
            Seleccionar logo
          </UButton>
          <UButton
            v-if="previewUrl"
            color="neutral"
            variant="ghost"
            @click="emit('clear')"
          >
            Quitar
          </UButton>
        </div>
      </div>

      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        :accept="acceptedTypes.join(',')"
        @change="onInputChange"
      >
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
    />

    <p class="text-xs text-slate-500 dark:text-slate-400">
      Fase 2: aqui podemos integrar crop avanzado con `cropperjs` y presets por marca.
    </p>
  </div>
</template>
