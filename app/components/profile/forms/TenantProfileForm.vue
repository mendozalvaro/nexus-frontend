<script setup lang="ts">
import type { TenantProfileFormState } from "@/composables/useTenantProfile";

const props = defineProps<{
  formState: TenantProfileFormState;
  saving: boolean;
}>();

const emit = defineEmits<{
  save: [];
  update: [field: keyof TenantProfileFormState, value: string];
}>();

const updateField = (field: keyof TenantProfileFormState, value: string) => {
  emit("update", field, value);
};
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-3">
      <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre completo</label>
      <UInput
        :model-value="formState.fullName"
        placeholder="Ej. Maria Lopez"
        size="lg"
        class="w-full"
        @update:model-value="updateField('fullName', $event)"
      />
    </div>

    <div class="space-y-3">
      <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Telefono</label>
      <UInput
        :model-value="formState.phone"
        type="tel"
        placeholder="+591 70000000"
        size="lg"
        class="w-full"
        @update:model-value="updateField('phone', $event)"
      />
    </div>

    <div class="space-y-3">
      <label class="text-sm font-medium text-slate-700 dark:text-slate-300">URL del avatar</label>
      <UInput
        :model-value="formState.avatarUrl"
        type="url"
        placeholder="https://ejemplo.com/avatar.jpg"
        size="lg"
        class="w-full"
        @update:model-value="updateField('avatarUrl', $event)"
      />
    </div>

    <div class="flex justify-end pt-2">
      <UButton color="primary" :loading="saving" @click="emit('save')">
        Guardar cambios
      </UButton>
    </div>
  </div>
</template>
