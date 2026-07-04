<script setup lang="ts">
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

import type { CustomerRow } from "@/composables/useCustomers";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  sourceCustomer: CustomerRow | null;
  candidates: CustomerRow[];
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [string];
}>();

const targetClientId = ref("");

const candidateOptions = computed(() =>
  props.candidates.map((row) => ({
    label: `${row.fullName} · ${row.email ?? "sin email"}`,
    value: row.clientId,
  })),
);

watch(
  () => [props.open, props.candidates] as const,
  ([isOpen, candidates]) => {
    if (!isOpen) return;
    targetClientId.value = candidates[0]?.clientId ?? "";
  },
  { immediate: true },
);
</script>

<template>
  <UModal
    :open="open"
    title="Fusionar clientes"
    description="Consolida historial y relaciones del cliente origen en un cliente destino."
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emits('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <AdminFormSection
          title="Cliente origen"
          description="Este cliente quedará inactivo dentro de la organización."
          :columns="1"
        >
          <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <p class="font-medium text-slate-950 dark:text-white">
              {{ sourceCustomer?.fullName ?? "N/A" }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ sourceCustomer?.email ?? sourceCustomer?.phone ?? "Sin dato de contacto" }}
            </p>
          </div>
        </AdminFormSection>

        <AdminFormSection
          title="Cliente destino"
          description="Selecciona el cliente que conservará las relaciones y el historial."
          :columns="1"
        >
          <UFormField label="Cliente destino">
            <USelect
              v-model="targetClientId"
              :items="candidateOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona un cliente"
              :disabled="loading"
              class="w-full"
              :ui="ADMIN_FIELD_UI"
            />
          </UFormField>
        </AdminFormSection>

        <AdminFormActions>
          <UButton color="neutral" variant="soft" :disabled="loading" @click="emits('update:open', false)">
            Cancelar
          </UButton>
          <UButton color="primary" :loading="loading" :disabled="!targetClientId" @click="emits('submit', targetClientId)">
            Fusionar
          </UButton>
        </AdminFormActions>
      </div>
    </template>
  </UModal>
</template>
