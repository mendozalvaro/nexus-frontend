<script setup lang="ts">
import type { ReservationStayActionPayload } from "@/composables/useReservations";

type StayMode =
  | "check_out"
  | "extend_stay"
  | "mark_open_ended"
  | "define_check_out";

const props = defineProps<{
  open: boolean;
  loading: boolean;
  status: string;
  isOpenEnded: boolean;
  currentCheckOut: string;
  initialMode?: StayMode | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [payload: ReservationStayActionPayload];
}>();

const mode = ref<StayMode>("check_out");
const effectiveCheckOut = ref("");
const notes = ref("");

const options = computed(() => {
  if (props.status === "checked_in" && props.isOpenEnded) {
    return [
      { label: "Solo check-out", value: "check_out" as const },
      { label: "Definir nueva fecha de salida", value: "define_check_out" as const },
    ];
  }

  if (props.status === "checked_in") {
    return [
      { label: "Solo check-out", value: "check_out" as const },
      { label: "Alargar estadía", value: "extend_stay" as const },
      { label: "Marcar indefinida", value: "mark_open_ended" as const },
    ];
  }

  return [];
});

const needsCheckOutDate = computed(() => mode.value === "extend_stay" || mode.value === "define_check_out");

const canSubmit = computed(() => {
  if (needsCheckOutDate.value) {
    return effectiveCheckOut.value.length === 10;
  }

  return options.value.length > 0;
});

const resetForm = () => {
  mode.value = props.initialMode && options.value.some((option) => option.value === props.initialMode)
    ? props.initialMode
    : (options.value[0]?.value ?? "check_out");
  effectiveCheckOut.value = props.currentCheckOut ?? "";
  notes.value = "";
};

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
}, { immediate: true });

watch(options, (currentOptions) => {
  if (!currentOptions.some((option) => option.value === mode.value)) {
    mode.value = currentOptions[0]?.value ?? "check_out";
  }
});

const submit = () => {
  if (!canSubmit.value) {
    return;
  }

  let payload: ReservationStayActionPayload;

  switch (mode.value) {
    case "check_out":
      payload = { action: "check_out", notes: notes.value || undefined };
      break;
    case "extend_stay":
      payload = { action: "extend_stay", effectiveCheckOut: effectiveCheckOut.value, notes: notes.value || undefined };
      break;
    case "mark_open_ended":
      payload = { action: "extend_stay", openEnded: true, notes: notes.value || undefined };
      break;
    case "define_check_out":
      payload = { action: "extend_stay", effectiveCheckOut: effectiveCheckOut.value, openEnded: false, notes: notes.value || undefined };
      break;
  }

  emit("submit", payload);
};
</script>

<template>
  <UModal
    :open="open"
    title="Gestionar estadia"
    description="Selecciona la operacion disponible para la estadia activa."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Acción">
          <USelectMenu
            v-model="mode"
            :items="options"
            value-key="value"
            label-key="label"
          />
        </UFormField>

        <UFormField v-if="needsCheckOutDate" label="Nueva fecha de salida">
          <UInput v-model="effectiveCheckOut" type="date" />
        </UFormField>

        <UFormField label="Notas">
          <UTextarea v-model="notes" :rows="3" placeholder="Observaciones de estadía, extensión o cierre." />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">
          Cancelar
        </UButton>
        <UButton color="primary" :loading="loading" :disabled="!canSubmit" @click="submit">
          Guardar
        </UButton>
      </div>
    </template>
  </UModal>
</template>




