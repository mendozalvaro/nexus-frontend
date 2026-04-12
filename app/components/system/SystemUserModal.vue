<script setup lang="ts">
import SystemUserForm from "@/components/system/SystemUserForm.vue";

interface FormState {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  role: string;
  permissionsJson: string;
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
  <UModal :open="props.open" :close="true" @update:open="emit('update:open', $event)" @close="closeModal">
    <template #body>
      <div class="p-2">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ isEditing ? "Editar Usuario" : "Crear Usuario del Sistema" }}
          </h3>
        </div>

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
