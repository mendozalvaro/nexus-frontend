<script setup lang="ts">
const emit = defineEmits<{
  "update:registerPaymentNow": [value: boolean];
  "update:paymentAmount": [value: number];
  "update:paymentMethod": [value: string];
  "update:paymentReference": [value: string];
  "update:goToPayment": [value: boolean];
}>();

const props = defineProps<{
  registerPaymentNow: boolean;
  goToPayment: boolean;
  paymentAmount: number;
  paymentAmountError?: string;
  paymentMethod: string;
  paymentReference: string;
  totalAmount: number;
  paymentMethodOptions: Array<{ label: string; value: string }>;
}>();

const inferredPaymentTypeLabel = computed(() => {
  if (props.paymentAmount <= 0 || props.paymentAmount < props.totalAmount) {
    return "Pago parcial";
  }

  return "Pago total";
});
</script>

<template>
  <UCard>
    <template #header><h3 class="font-semibold">Pago</h3></template>
    <div class="space-y-4">
      <UCheckbox
        :model-value="registerPaymentNow"
        label="Registrar pago ahora"
        @update:model-value="emit('update:registerPaymentNow', Boolean($event))"
      />

      <div v-if="registerPaymentNow" class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <UFormField label="Monto" :error="paymentAmountError">
          <UInput
            :model-value="paymentAmount"
            type="number"
            min="0.01"
            :max="totalAmount"
            step="0.01"
            @update:model-value="emit('update:paymentAmount', Number($event ?? 0))"
          />
        </UFormField>
        <UFormField label="Metodo de pago">
          <USelectMenu
            :model-value="paymentMethod"
            :items="paymentMethodOptions"
            value-key="value"
            label-key="label"
            @update:model-value="emit('update:paymentMethod', String($event ?? ''))"
          />
        </UFormField>
        <div class="rounded-xl border border-default bg-slate-50/80 px-4 py-3 text-sm dark:bg-slate-900/60">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tipo de pago</p>
          <p class="mt-1 font-medium text-slate-950 dark:text-white">{{ inferredPaymentTypeLabel }}</p>
        </div>
        <UFormField label="Referencia">
          <UInput
            :model-value="paymentReference"
            placeholder="Opcional"
            @update:model-value="emit('update:paymentReference', String($event ?? ''))"
          />
        </UFormField>
      </div>

      <div class="flex items-center justify-between gap-3 rounded-lg border border-default px-4 py-3 text-sm">
        <span>Total estimado</span>
        <span class="font-semibold">${{ totalAmount.toFixed(2) }}</span>
      </div>

      <UCheckbox
        :model-value="goToPayment"
        label="Abrir detalle para cobrar despues"
        @update:model-value="emit('update:goToPayment', Boolean($event))"
      />
    </div>
  </UCard>
</template>
