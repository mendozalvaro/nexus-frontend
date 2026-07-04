<script setup lang="ts">
import CustomerForm from "@/components/customers/forms/CustomerForm.vue";

import type { CustomerMutationPayload, CustomerRow } from "@/composables/useCustomers";

const props = defineProps<{
  open: boolean;
  mode: "create" | "edit";
  loading?: boolean;
  initialValue?: CustomerRow | null;
  showBillingFields?: boolean;
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [CustomerMutationPayload];
  cancel: [];
}>();

const formInitialValue = computed(() => {
  if (props.mode !== "edit" || !props.initialValue) {
    return undefined;
  }

  return {
    firstName: props.initialValue.firstName ?? "",
    lastName: props.initialValue.lastName ?? "",
    phone: props.initialValue.phone ?? "",
    email: props.initialValue.email ?? "",
    billingName: props.initialValue.billingName ?? "",
    billingEmail: props.initialValue.billingEmail ?? "",
    billingPhone: props.initialValue.billingPhone ?? "",
    documentType: props.initialValue.documentType ?? null,
    documentNumber: props.initialValue.documentNumber ?? "",
  };
});
</script>

<template>
  <UModal
    :open="open"
    :title="mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'"
    :description="mode === 'create'
      ? (showBillingFields ? 'Registra informacion base y de facturacion del cliente.' : 'Registra la informacion base y de contacto del cliente.')
      : (showBillingFields ? 'Actualiza los datos comerciales y de contacto del cliente.' : 'Actualiza los datos base y de contacto del cliente.')"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <CustomerForm
        :loading="loading"
        :initial-value="formInitialValue"
        :submit-label="mode === 'create' ? 'Crear cliente' : 'Guardar cambios'"
        :show-billing-fields="showBillingFields"
        @submit="emits('submit', $event)"
        @cancel="emits('cancel')"
      />
    </template>
  </UModal>
</template>
