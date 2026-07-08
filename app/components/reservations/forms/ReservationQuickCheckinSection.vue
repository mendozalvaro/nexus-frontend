<script setup lang="ts">
const emit = defineEmits<{
  "update:branchId": [value: string];
  "update:checkOut": [value: string];
  "select-preset": [value: string];
}>();

const props = defineProps<{
  branchId: string;
  branchError?: string;
  branches: Array<{ label: string; value: string }>;
  checkIn: string;
  checkOut: string;
  stayPreset: string;
  stayPresetOptions: Array<{ value: string; label: string }>;
}>();

const internalBranchId = computed({
  get: () => props.branchId,
  set: (value: string | { value?: string } | null | undefined) => {
    if (typeof value === "string") {
      emit("update:branchId", value);
      return;
    }

    emit("update:branchId", value?.value ?? "");
  },
});
</script>

<template>
  <UCard>
    <template #header><h3 class="font-semibold">Ingreso rapido</h3></template>
    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <UFormField label="Sucursal" required :error="branchError">
          <USelectMenu
            v-model="internalBranchId"
            :items="branches"
            value-key="value"
            label-key="label"
            placeholder="Seleccionar..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Ingreso">
          <div class="flex h-10 items-center rounded-lg border border-default px-3 text-sm font-medium">
            {{ checkIn }}
          </div>
        </UFormField>

        <UFormField label="Salida">
          <UInput
            :model-value="checkOut"
            type="date"
            :disabled="stayPreset !== 'custom'"
            :min="checkIn"
            class="w-full"
            @update:model-value="emit('update:checkOut', String($event ?? ''))"
          />
        </UFormField>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="option in stayPresetOptions"
          :key="option.value"
          :color="stayPreset === option.value ? 'primary' : 'neutral'"
          :variant="stayPreset === option.value ? 'solid' : 'soft'"
          @click="emit('select-preset', option.value)"
        >
          {{ option.label }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
