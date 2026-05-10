<script setup lang="ts">
import { z } from "zod";

import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  appointmentLabel?: string;
}>(), {
  loading: false,
  appointmentLabel: "esta cita",
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [string];
}>();

const state = reactive({
  reason: "",
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      state.reason = "";
    }
  },
);

const schema = z.object({
  reason: z.string().trim().min(4, "Debes indicar el motivo de la cancelación.").max(280, "El motivo no puede superar 280 caracteres."),
});

const submit = () => {
  emits("submit", state.reason.trim());
};
</script>

<template>
  <UModal
    :open="open"
    title="Cancelar cita"
    description="Esta acción conserva el historial y registra el motivo para auditoría."
    :ui="{ content: 'max-w-xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm leading-6 text-slate-500 dark:text-slate-400">
          Vas a cancelar <span class="font-medium text-slate-950 dark:text-white">{{ appointmentLabel }}</span>.
        </p>

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
          <AdminFormSection
            title="Motivo de cancelación"
            description="Explica la razón operativa o del cliente para conservar la trazabilidad."
            :columns="1"
          >
            <UFormField label="Motivo" name="reason">
              <UTextarea
                v-model="state.reason"
                :rows="4"
                placeholder="Ej. Cliente solicitó reagendar, ausencia, incidencia operativa."
                :disabled="loading"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>
          </AdminFormSection>

          <AdminFormActions>
            <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" :disabled="loading" @click="emits('update:open', false)">
              Volver
            </UButton>
            <UButton type="submit" color="error" block class="min-h-11 sm:w-auto" :loading="loading">
              Confirmar cancelación
            </UButton>
          </AdminFormActions>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
