<script setup lang="ts">
import type { SystemProfileFormState } from "@/composables/useSystemProfile";

const props = defineProps<{
  formState: SystemProfileFormState;
  saving: boolean;
  mode: "general" | "password";
}>();

const emit = defineEmits<{
  save: [];
  update: [field: keyof SystemProfileFormState, value: string];
  updatePassword: [field: "currentPassword" | "newPassword" | "confirmPassword", value: string];
}>();

const updateField = (field: keyof SystemProfileFormState, value: string) => {
  emit("update", field, value);
};
</script>

<template>
  <div class="space-y-5">
    <template v-if="mode === 'general'">
      <div class="space-y-3">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre completo</label>
        <UInput
          :model-value="formState.fullName"
          placeholder="Ej. Admin System"
          size="lg"
          class="w-full"
          @update:model-value="updateField('fullName', $event)"
        />
      </div>

      <div class="space-y-3">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
        <UInput
          :model-value="formState.email"
          type="email"
          placeholder="admin@nexuspos.com"
          size="lg"
          class="w-full"
          @update:model-value="updateField('email', $event)"
        />
      </div>
    </template>

    <template v-else>
      <div class="space-y-3">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Contrasena actual</label>
        <UInput
          type="password"
          autocomplete="current-password"
          placeholder="Ingresa tu contrasena actual"
          size="lg"
          class="w-full"
          @update:model-value="(v) => emit('updatePassword', 'currentPassword', String(v ?? ''))"
        />
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nueva contrasena</label>
          <UInput
            type="password"
            autocomplete="new-password"
            placeholder="Minimo 8 caracteres"
            size="lg"
            class="w-full"
            @update:model-value="(v) => emit('updatePassword', 'newPassword', String(v ?? ''))"
          />
        </div>

        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar contrasena</label>
          <UInput
            type="password"
            autocomplete="new-password"
            placeholder="Repite la contrasena"
            size="lg"
            class="w-full"
            @update:model-value="(v) => emit('updatePassword', 'confirmPassword', String(v ?? ''))"
          />
        </div>
      </div>
    </template>

    <div class="flex justify-end pt-2">
      <UButton color="primary" :loading="saving" @click="emit('save')">
        Guardar cambios
      </UButton>
    </div>
  </div>
</template>
