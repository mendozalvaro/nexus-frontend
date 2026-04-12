<script setup lang="ts">
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

const selectedReason = ref<(typeof reasonOptions)[number]>("Datos incorrectos");
const customReason = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      selectedReason.value = "Datos incorrectos";
      customReason.value = "";
    }
  },
);

const canSubmit = computed(() =>
  selectedReason.value !== "Otro" || customReason.value.trim().length >= 4,
);

const handleSubmit = () => {
  if (!canSubmit.value) {
    return;
  }

  const finalReason = selectedReason.value === "Otro"
    ? customReason.value.trim()
    : selectedReason.value;

  emit("submit", finalReason);
};
</script>

<template>
  <UModal
    :open="open"
    title="Rechazar comprobante"
    :description="validation ? `Indica el motivo para ${validation.organizationName}.` : 'Selecciona un motivo de rechazo.'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            Motivo
          </label>
          <div class="grid gap-2">
            <button
              v-for="option in reasonOptions"
              :key="option"
              type="button"
              class="rounded-xl border px-3 py-2 text-left text-sm transition"
              :class="selectedReason === option
                ? 'border-error-400 bg-error-50 text-error-700 dark:border-error-700 dark:bg-error-950/30 dark:text-error-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'"
              @click="selectedReason = option"
            >
              {{ option }}
            </button>
          </div>
        </div>

        <div v-if="selectedReason === 'Otro'" class="space-y-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            Detalle adicional
          </label>
          <textarea
            v-model="customReason"
            rows="4"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-error-400 dark:border-slate-800 dark:bg-slate-950"
            placeholder="Explica por que se rechaza el comprobante."
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3">
        <UButton
          color="neutral"
          variant="soft"
          block
          @click="emit('update:open', false)"
        >
          Cancelar
        </UButton>
        <UButton
          color="error"
          block
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          Confirmar rechazo
        </UButton>
      </div>
    </template>
  </UModal>
</template>
