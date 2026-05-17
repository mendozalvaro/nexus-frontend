<script setup lang="ts">
import type { ClientProfileFormState, ClientBillingFormState } from "@/composables/useClientProfile";

const props = defineProps<{
  formState: ClientProfileFormState;
  billingState: ClientBillingFormState;
  saving: boolean;
  mode: "general" | "billing";
}>();

const emit = defineEmits<{
  save: [];
  updateGeneral: [field: keyof ClientProfileFormState, value: string];
  updateBilling: [field: keyof ClientBillingFormState, value: string];
}>();

const updateGeneral = (field: keyof ClientProfileFormState, value: string) => {
  emit("updateGeneral", field, value);
};

const updateBilling = (field: keyof ClientBillingFormState, value: string) => {
  emit("updateBilling", field, value);
};
</script>

<template>
  <div class="space-y-5">
    <template v-if="mode === 'general'">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
          <UInput
            :model-value="formState.firstName"
            placeholder="Juan"
            size="lg"
            class="w-full"
            @update:model-value="updateGeneral('firstName', $event)"
          />
        </div>

        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Apellido</label>
          <UInput
            :model-value="formState.lastName"
            placeholder="Perez"
            size="lg"
            class="w-full"
            @update:model-value="updateGeneral('lastName', $event)"
          />
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <UInput
            :model-value="formState.email"
            type="email"
            placeholder="juan@ejemplo.com"
            size="lg"
            class="w-full"
            @update:model-value="updateGeneral('email', $event)"
          />
        </div>

        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Telefono</label>
          <UInput
            :model-value="formState.phone"
            type="tel"
            placeholder="+591 70000000"
            size="lg"
            class="w-full"
            @update:model-value="updateGeneral('phone', $event)"
          />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="space-y-3">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Razon social / Empresa</label>
        <UInput
          :model-value="billingState.companyName"
          placeholder="Mi Empresa SRL"
          size="lg"
          class="w-full"
          @update:model-value="updateBilling('companyName', $event)"
        />
      </div>

      <div class="space-y-3">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">NIT / CI / RUC</label>
        <UInput
          :model-value="billingState.taxId"
          placeholder="1234567890"
          size="lg"
          class="w-full"
          @update:model-value="updateBilling('taxId', $event)"
        />
      </div>

      <div class="space-y-3">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Direccion fiscal</label>
        <UInput
          :model-value="billingState.address"
          placeholder="Av. Principal #123"
          size="lg"
          class="w-full"
          @update:model-value="updateBilling('address', $event)"
        />
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Ciudad</label>
          <UInput
            :model-value="billingState.city"
            placeholder="La Paz"
            size="lg"
            class="w-full"
            @update:model-value="updateBilling('city', $event)"
          />
        </div>

        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Notas adicionales</label>
          <UInput
            :model-value="billingState.notes"
            placeholder="Observaciones de facturacion"
            size="lg"
            class="w-full"
            @update:model-value="updateBilling('notes', $event)"
          />
        </div>
      </div>
    </template>

    <div class="flex justify-end pt-2">
      <UButton color="primary" :loading="saving" @click="emit('save')">
        Guardar cambios
      </UButton>
    </div>
  </div>
</template>
