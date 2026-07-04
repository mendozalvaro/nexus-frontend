<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  loading: boolean;
  amount: number;
  paymentMethod: string;
  paymentType: string;
  reference: string;
  balance: number;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  "update:amount": [number];
  "update:paymentMethod": [string];
  "update:paymentType": [string];
  "update:reference": [string];
  submit: [];
}>();
</script>

<template>
  <UModal :open="open" :title="'Registrar pago'" @update:open="(value) => emit('update:open', value)">
    <template #body>
      <UForm @submit="emit('submit')" class="space-y-4">
        <UFormField label="Monto" required>
          <UInput :model-value="amount" type="number" min="0.01" step="0.01" :max="balance" class="w-full" @update:model-value="(value) => emit('update:amount', Number(value))" />
        </UFormField>
        <UFormField label="Metodo de pago">
          <USelectMenu :model-value="paymentMethod" :items="[
            { label: 'Efectivo', value: 'cash' },
            { label: 'Tarjeta', value: 'card' },
            { label: 'Transferencia', value: 'transfer' },
            { label: 'QR', value: 'qr' },
            { label: 'Billetera digital', value: 'digital_wallet' },
          ]" value-key="value" label-key="label" class="w-full" @update:model-value="(value) => emit('update:paymentMethod', value)" />
        </UFormField>
        <UFormField label="Tipo de pago">
          <USelectMenu :model-value="paymentType" :items="[
            { label: 'Deposito', value: 'deposit' },
            { label: 'Saldo', value: 'balance' },
            { label: 'Completo', value: 'full' },
          ]" value-key="value" label-key="label" class="w-full" @update:model-value="(value) => emit('update:paymentType', value)" />
        </UFormField>
        <UFormField label="Referencia">
          <UInput :model-value="reference" placeholder="Opcional" class="w-full" @update:model-value="(value) => emit('update:reference', value)" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">Cancelar</UButton>
          <UButton type="submit" color="primary" :loading="loading" :disabled="amount <= 0">
            Registrar pago
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
