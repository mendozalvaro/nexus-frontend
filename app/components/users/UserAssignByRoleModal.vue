<script setup lang="ts">
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

const selectedUserId = ref<string | undefined>(undefined);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    selectedUserId.value = undefined;
  },
  { immediate: true },
);

const title = computed(() => {
  if (props.role === "manager") {
    return "Anadir manager";
  }

  return "Anadir empleado";
});

const description = computed(() => {
  if (!props.role) {
    return "Selecciona un usuario para asignarlo a la sucursal.";
  }

  return `Selecciona un usuario con rol ${props.role} para asignarlo a ${props.branchLabel}.`;
});

const handleSubmit = () => {
  if (!selectedUserId.value) {
    return;
  }

  emits("submit", selectedUserId.value);
};
</script>

<template>
  <UModal :open="open" :title="title" :description="description" @update:open="emits('update:open', $event)">
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="items.length === 0"
          color="warning"
          variant="soft"
          icon="i-lucide-users"
          title="No hay usuarios disponibles"
          description="No se encontraron usuarios con este rol para asignar en esta sucursal."
        />

        <UFormField v-else label="Usuario" name="userId">
          <USelect
            v-model="selectedUserId"
            :items="items"
            label-key="label"
            value-key="value"
            placeholder="Selecciona un usuario"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="primary" :loading="loading" :disabled="!selectedUserId || items.length === 0" @click="handleSubmit">
          Asignar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
