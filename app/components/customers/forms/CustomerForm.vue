<script setup lang="ts">
import { z } from "zod";

import type { CustomerDocumentType, CustomerMutationPayload } from "@/composables/useCustomers";
import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface CustomerFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  billingName: string;
  billingEmail: string;
  billingPhone: string;
  documentType: CustomerDocumentType | null;
  documentNumber: string;
}

const props = withDefaults(defineProps<{
  loading?: boolean;
  initialValue?: Partial<CustomerFormState>;
  submitLabel?: string;
  showBillingFields?: boolean;
}>(), {
  loading: false,
  initialValue: () => ({}),
  submitLabel: "Guardar cliente",
  showBillingFields: true,
});

const emits = defineEmits<{
  submit: [CustomerMutationPayload];
  cancel: [];
}>();

const state = reactive<CustomerFormState>({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  billingName: "",
  billingEmail: "",
  billingPhone: "",
  documentType: null,
  documentNumber: "",
});

watch(
  () => props.initialValue,
  (value) => {
    state.firstName = value.firstName ?? "";
    state.lastName = value.lastName ?? "";
    state.phone = value.phone ?? "";
    state.email = value.email ?? "";
    state.billingName = value.billingName ?? "";
    state.billingEmail = value.billingEmail ?? "";
    state.billingPhone = value.billingPhone ?? "";
    state.documentType = value.documentType ?? null;
    state.documentNumber = value.documentNumber ?? "";
  },
  { immediate: true, deep: true },
);

const schema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio."),
  lastName: z.string().trim().max(120).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  billingName: z.string().trim().optional(),
  billingEmail: z.string().trim().optional(),
  billingPhone: z.string().trim().optional(),
  documentType: z.enum(["CI", "NIT", "Pasaporte", "Otro"]).nullable(),
  documentNumber: z.string().trim().max(40, "El numero de documento no puede superar 40 caracteres.").optional(),
}).superRefine((value, context) => {
  if (!value.phone && !value.email) {
    context.addIssue({
      code: "custom",
      path: ["phone"],
      message: "Debes enviar al menos telefono o email.",
    });
  }

  if (value.email && !z.string().email().safeParse(value.email).success) {
    context.addIssue({
      code: "custom",
      path: ["email"],
      message: "El email no es valido.",
    });
  }

  if (props.showBillingFields && value.billingEmail && !z.string().email().safeParse(value.billingEmail).success) {
    context.addIssue({
      code: "custom",
      path: ["billingEmail"],
      message: "El email de facturacion no es valido.",
    });
  }

  if (props.showBillingFields && ((value.documentType && !value.documentNumber) || (value.documentNumber && !value.documentType))) {
    context.addIssue({
      code: "custom",
      path: !value.documentType ? ["documentType"] : ["documentNumber"],
      message: "Tipo y numero de documento deben registrarse juntos.",
    });
  }
});

const documentTypeOptions: Array<{ label: string; value: CustomerDocumentType }> = [
  { label: "CI", value: "CI" },
  { label: "NIT", value: "NIT" },
  { label: "Pasaporte", value: "Pasaporte" },
  { label: "Otro", value: "Otro" },
];

const documentTypeModel = computed({
  get: () => state.documentType ?? undefined,
  set: (value: CustomerDocumentType | undefined) => {
    state.documentType = value ?? null;
  },
});

const submit = () => {
  emits("submit", {
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim() || null,
    phone: state.phone.trim() || null,
    email: state.email.trim() || null,
    billingName: props.showBillingFields ? (state.billingName.trim() || null) : null,
    billingEmail: props.showBillingFields ? (state.billingEmail.trim() || null) : null,
    billingPhone: props.showBillingFields ? (state.billingPhone.trim() || null) : null,
    documentType: props.showBillingFields ? state.documentType : null,
    documentNumber: props.showBillingFields ? (state.documentNumber.trim() || null) : null,
  });
};
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-6" @submit="submit">
    <AdminFormSection
      title="Informacion del cliente"
      description="Datos base para identificar y contactar al cliente."
      :columns="1"
    >
      <AdminFieldGroup :columns="2">
        <UFormField label="Nombre" name="firstName">
          <UInput v-model="state.firstName" placeholder="Ej. Maria" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Apellido" name="lastName">
          <UInput v-model="state.lastName" placeholder="Ej. Mendoza" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Telefono" name="phone">
          <UInput v-model="state.phone" placeholder="70000000" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Email" name="email">
          <UInput v-model="state.email" placeholder="cliente@correo.com" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <AdminFormSection
      v-if="showBillingFields"
      title="Facturacion"
      description="Datos comerciales para comprobantes y seguimiento."
      :columns="1"
    >
      <AdminFieldGroup :columns="2">
        <UFormField label="Razon social" name="billingName">
          <UInput v-model="state.billingName" placeholder="Ej. Comercial Mendoza SRL" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Email facturacion" name="billingEmail">
          <UInput v-model="state.billingEmail" placeholder="facturacion@empresa.com" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Telefono facturacion" name="billingPhone" class="sm:col-span-2">
          <UInput v-model="state.billingPhone" placeholder="Telefono para comprobantes" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Tipo de documento" name="documentType">
          <USelect
            v-model="documentTypeModel"
            :items="documentTypeOptions"
            label-key="label"
            value-key="value"
            placeholder="Selecciona un tipo"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Nro documento" name="documentNumber">
          <UInput v-model="state.documentNumber" placeholder="Ej. 12345678 o 1020304011" :disabled="loading" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <AdminFormActions>
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ submitLabel }}
      </UButton>
    </AdminFormActions>
  </UForm>
</template>
