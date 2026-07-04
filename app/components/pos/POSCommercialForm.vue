<script setup lang="ts">

export interface POSCommercialDraft {
  note: string;
}

const props = defineProps<{
  loading?: boolean;
  initialDraft?: POSCommercialDraft | null;
  editing?: boolean;
}>();

const emits = defineEmits<{
  "submit-sale": [payload: { note: string }];
  "submit-proforma": [payload: { note: string }];
}>();

const state = reactive<POSCommercialDraft>({
  note: "",
});

const applyDraft = (draft?: POSCommercialDraft | null) => {
  state.note = draft?.note ?? "";
};

watch(
  () => props.initialDraft,
  (value) => {
    applyDraft(value);
  },
  { immediate: true, deep: true },
);

const submitSale = () => {
  emits("submit-sale", {
    note: state.note.trim(),
  });
};

const submitProforma = () => {
  emits("submit-proforma", {
    note: state.note.trim(),
  });
};
</script>

<template>
  <UCard class="rounded-[1.75rem]">
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-slate-950 dark:text-white">
          {{ editing ? "Editar venta" : "Registrar venta o proforma" }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Agrega una nota opcional y confirma el tipo de registro.
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <div>
        <label class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Nota</label>
        <UTextarea v-model="state.note" :rows="3" placeholder="Nota comercial u observacion" :disabled="loading" />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UButton color="primary" class="min-h-11 justify-center" :loading="loading" @click="submitSale">
          {{ editing ? "Actualizar venta" : "Registrar venta" }}
        </UButton>
        <UButton color="neutral" variant="soft" class="min-h-11 justify-center" :loading="loading" @click="submitProforma">
          {{ editing ? "Actualizar + proforma" : "Registrar proforma" }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
