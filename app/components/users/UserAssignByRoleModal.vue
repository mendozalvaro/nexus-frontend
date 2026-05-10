<script setup lang="ts">
import { z } from "zod";

import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

type AssignRole = "manager" | "employee";

interface AssignOption {
  label: string;
  value: string;
}

const props = withDefaults(defineProps<{
  open: boolean;
  role: AssignRole | null;
  branchLabel: string;
  items: AssignOption[];
  loading?: boolean;
}>(), {
  loading: false,
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [string];
}>();

const state = reactive({
  userId: "",
});

const schema = z.object({
  userId: z.string().min(1, "Selecciona un usuario."),
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.userId = "";
  },
  { immediate: true },
);

const title = computed(() => {
  if (props.role === "manager") {
    return "Añadir manager";
  }

  return "Añadir empleado";
});

const description = computed(() => {
  if (!props.role) {
    return "Selecciona un usuario para asignarlo a la sucursal.";
  }

  return `Selecciona un usuario con rol ${props.role} para asignarlo a ${props.branchLabel}.`;
});

const handleSubmit = () => {
  emits("submit", state.userId);
};
</script>

<template>
  <UModal :open="open" :title="title" :description="description" :ui="{ content: 'max-w-xl' }" @update:open="emits('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="handleSubmit">
        <UAlert
          v-if="items.length === 0"
          color="warning"
          variant="soft"
          icon="i-lucide-users"
          title="No hay usuarios disponibles"
          description="No se encontraron usuarios con este rol para asignar en esta sucursal."
        />

        <AdminFormSection
          v-else
          title="Asignación"
          description="Elige el usuario disponible para incorporarlo a la sucursal actual."
          :columns="1"
        >
          <UFormField label="Usuario" name="userId">
            <USelect
              v-model="state.userId"
              :items="items"
              label-key="label"
              value-key="value"
              placeholder="Selecciona un usuario"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>
        </AdminFormSection>
      </UForm>
    </template>

    <template #footer>
      <AdminFormActions>
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="primary" :loading="loading" :disabled="!state.userId || items.length === 0" @click="handleSubmit">
          Asignar
        </UButton>
      </AdminFormActions>
    </template>
  </UModal>
</template>
