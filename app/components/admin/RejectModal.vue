<script setup lang="ts">
import { z } from "zod";

import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

import type { PaymentValidationListRow } from "@/composables/usePaymentSystem";

const props = defineProps<{
  open: boolean;
  submitting?: boolean;
  validation: PaymentValidationListRow | null;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  submit: [string];
}>();

const reasonOptions = [
  "Datos incorrectos",
  "Comprobante ilegible",
  "Monto incorrecto",
  "Transferencia no encontrada",
  "Otro",
] as const;

const state = reactive({
  selectedReason: "Datos incorrectos" as (typeof reasonOptions)[number],
  customReason: "",
});

const schema = z.object({
  selectedReason: z.enum(reasonOptions),
  customReason: z.string(),
}).superRefine((value, context) => {
  if (value.selectedReason === "Otro" && value.customReason.trim().length < 4) {
    context.addIssue({
      code: "custom",
      path: ["customReason"],
      message: "Explica el motivo con al menos 4 caracteres.",
    });
  }
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      state.selectedReason = "Datos incorrectos";
      state.customReason = "";
    }
  },
);

const canSubmit = computed(() =>
  state.selectedReason !== "Otro" || state.customReason.trim().length >= 4,
);

const handleSubmit = () => {
  if (!canSubmit.value) {
    return;
  }

  const finalReason = state.selectedReason === "Otro"
    ? state.customReason.trim()
    : state.selectedReason;

  emit("submit", finalReason);
};
</script>

<template>
  <UModal
    :open="open"
    title="Rechazar comprobante"
    :description="validation ? `Indica el motivo para ${validation.organizationName}.` : 'Selecciona un motivo de rechazo.'"
    :ui="{ content: 'max-w-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="handleSubmit">
        <AdminFormSection
          title="Motivo del rechazo"
          description="Selecciona la razón principal y agrega detalle si el caso no encaja en los motivos comunes."
          :columns="1"
        >
          <div class="grid gap-2">
            <button
              v-for="option in reasonOptions"
              :key="option"
              type="button"
              class="rounded-xl border px-3 py-2 text-left text-sm transition"
              :class="state.selectedReason === option
                ? 'border-error-400 bg-error-50 text-error-700 dark:border-error-700 dark:bg-error-950/30 dark:text-error-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'"
              @click="state.selectedReason = option"
            >
              {{ option }}
            </button>
          </div>

          <UFormField v-if="state.selectedReason === 'Otro'" label="Detalle adicional" name="customReason">
            <UTextarea
              v-model="state.customReason"
              :rows="4"
              placeholder="Explica por qué se rechaza el comprobante."
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>
        </AdminFormSection>
      </UForm>
    </template>

    <template #footer>
      <AdminFormActions>
        <UButton color="neutral" variant="soft" block @click="emit('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="error" block :loading="submitting" :disabled="!canSubmit" @click="handleSubmit">
          Confirmar rechazo
        </UButton>
      </AdminFormActions>
    </template>
  </UModal>
</template>
