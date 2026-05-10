<script setup lang="ts">
import SystemUserForm from "@/components/system/SystemUserForm.vue";

interface FormState {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  role: "system" | "support";
}

interface Props {
  open: boolean;
  isEditing: boolean;
  formState: FormState;
  formError: string | null;
  actionLoading: boolean;
}

interface Emits {
  (e: "update:open", value: boolean): void;
  (e: "update:formState", value: FormState): void;
  (e: "save"): void;
  (e: "reset"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const closeModal = () => {
  emit("update:open", false);
  emit("reset");
};
</script>

<template>
  <UModal
    :open="props.open"
    :close="true"
    :title="isEditing ? 'Editar usuario de sistema' : 'Nuevo usuario de sistema'"
    :description="isEditing ? 'Actualiza credenciales y nivel de acceso del usuario.' : 'Crea un usuario interno con acceso a herramientas de sistema.'"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="emit('update:open', $event)"
    @close="closeModal"
  >
    <template #body>
      <div class="p-2">
        <SystemUserForm
          :is-editing="isEditing"
          :form-state="formState"
          :form-error="formError"
          :action-loading="actionLoading"
          @update:form-state="emit('update:formState', $event)"
          @save="emit('save')"
          @reset="emit('reset')"
        />
      </div>
    </template>
  </UModal>
</template>
