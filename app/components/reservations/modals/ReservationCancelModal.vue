<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  loading: boolean;
  reason: string;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  "update:reason": [string];
  submit: [];
}>();
</script>

<template>
  <UModal :open="open" :title="'Cancelar reserva'" @update:open="(value) => emit('update:open', value)">
    <template #body>
      <UForm @submit="emit('submit')" class="space-y-4">
        <UFormField label="Motivo de cancelacion" required>
          <UTextarea :model-value="reason" placeholder="Indique el motivo..." class="w-full" @update:model-value="(value) => emit('update:reason', value)" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">Volver</UButton>
          <UButton type="submit" color="neutral" :loading="loading" :disabled="!reason.trim()">
            Confirmar cancelacion
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

