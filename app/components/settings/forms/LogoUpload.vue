<script setup lang="ts">
import type { SettingsOrganization } from "@/composables/useSettings";

interface Props {
  org: SettingsOrganization | null;
  loading: boolean;
  mutationLoading: boolean;
  error: string | null;
}

interface Emits {
  (e: "upload", file: File): void;
  (e: "remove"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const logoError = ref<string | null>(null);
const logoPreview = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  logoError.value = null;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    logoError.value = "Solo se aceptan JPG, PNG o WebP.";
    input.value = "";
    return;
  }

  if (file.size > MAX_LOGO_SIZE) {
    logoError.value = "El logo no puede superar 2MB.";
    input.value = "";
    return;
  }

  logoPreview.value = URL.createObjectURL(file);
  emit("upload", file);
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const clearLogo = () => {
  if (logoPreview.value) {
    URL.revokeObjectURL(logoPreview.value);
    logoPreview.value = null;
  }
  if (fileInput.value) fileInput.value.value = "";
  emit("remove");
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start gap-6">
      <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
        <img
          v-if="org?.logo_url || logoPreview"
          :src="logoPreview || org?.logo_url || ''"
          alt="Logo organizacion"
          class="h-full w-full object-cover"
        />
        <UIcon
          v-else
          name="i-lucide-building-2"
          class="h-10 w-10 text-slate-400"
        />
      </div>

      <div class="space-y-2">
        <h3 class="font-medium text-slate-900 dark:text-white">Logo de la organizacion</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          JPG, PNG o WebP. Maximo 2MB. Se recomendara una imagen cuadrada.
        </p>
        <div class="flex gap-2">
          <UButton size="sm" color="primary" variant="soft" @click="triggerFileInput">
            {{ org?.logo_url ? "Cambiar logo" : "Subir logo" }}
          </UButton>
          <UButton
            v-if="org?.logo_url || logoPreview"
            size="sm"
            color="neutral"
            variant="soft"
            @click="clearLogo"
          >
            Quitar
          </UButton>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          @change="handleFileChange"
        />
      </div>
    </div>

    <div v-if="logoError" class="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
      <p class="text-sm text-red-700 dark:text-red-300">{{ logoError }}</p>
    </div>

    <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-if="mutationLoading" class="flex items-center gap-2 text-sm text-slate-500">
      <UIcon name="i-lucide-loader" class="h-4 w-4 animate-spin" />
      Subiendo logo...
    </div>
  </div>
</template>
