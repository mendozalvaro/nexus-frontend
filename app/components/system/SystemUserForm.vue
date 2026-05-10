<script setup lang="ts">
import { z } from "zod";

import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface Props {
  isEditing: boolean;
  formState: {
    email: string;
    fullName: string;
    password: string;
    confirmPassword: string;
    role: "system" | "support";
  };
  formError: string | null;
  actionLoading: boolean;
}

interface Emits {
  (e: "update:formState", value: Props["formState"]): void;
  (e: "save"): void;
  (e: "reset"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formState = computed({
  get: () => props.formState,
  set: (val) => emit("update:formState", val),
});

const schema = computed(() =>
  z.object({
    email: z.string().trim().email("Ingresa un email válido."),
    fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
    password: props.isEditing
      ? z.string().optional()
      : z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmPassword: z.string(),
    role: z.enum(["system", "support"]),
  }).superRefine((value, context) => {
    if (!props.isEditing || value.password?.trim().length) {
      if ((value.password ?? "").length < 8) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "La contraseña debe tener al menos 8 caracteres.",
        });
      }

      if (value.password !== value.confirmPassword) {
        context.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "La confirmación debe coincidir con la contraseña.",
        });
      }
    }
  }),
);
</script>

<template>
  <UForm :schema="schema" :state="formState" class="space-y-5" @submit="emit('save')">
    <AdminFormSection
      title="Identidad y acceso"
      description="Configura credenciales, nombre visible y nivel de acceso del usuario de sistema."
      :columns="2"
    >
      <AdminFieldGroup :columns="2" class="sm:col-span-2">
        <UFormField label="Email" name="email">
          <UInput
            v-model="formState.email"
            type="email"
            placeholder="usuario@dominio.com"
            class="w-full"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Nombre completo" name="fullName">
          <UInput
            v-model="formState.fullName"
            placeholder="Ej. Maria Lopez"
            class="w-full"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField :label="isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña'" name="password">
          <UInput
            v-model="formState.password"
            type="password"
            autocomplete="new-password"
            placeholder="Minimo 8 caracteres"
            class="w-full"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Confirmar contraseña" name="confirmPassword">
          <UInput
            v-model="formState.confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="Repite la contraseña"
            class="w-full"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Rol" name="role">
          <USelect
            v-model="formState.role"
            class="w-full"
            :items="[
              { label: 'system', value: 'system' },
              { label: 'support', value: 'support' },
            ]"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <UAlert
      v-if="formError"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="No se pudo guardar"
      :description="formError"
    />

    <AdminFormActions>
      <UButton variant="ghost" color="neutral" @click="$emit('reset')">
        Limpiar
      </UButton>
      <UButton type="submit" :loading="actionLoading" color="primary">
        {{ isEditing ? "Actualizar usuario" : "Crear usuario" }}
      </UButton>
    </AdminFormActions>
  </UForm>
</template>
