<script setup lang="ts">
import { z } from "zod";

import type {
  BranchBusinessHours,
  BranchMutationPayload,
  BranchWeekday,
} from "@/composables/useBranches";

const props = withDefaults(defineProps<{
  mode: "create" | "edit";
  loading?: boolean;
  initialValue?: Partial<BranchMutationPayload>;
  submitLabel?: string;
  cancelLabel?: string;
  limitMessage?: string | null;
}>(), {
  loading: false,
  initialValue: () => ({}),
  submitLabel: undefined,
  cancelLabel: "Cancelar",
  limitMessage: null,
});

const emits = defineEmits<{
  submit: [BranchMutationPayload];
  cancel: [];
}>();

const { weekdayOrder, createDefaultBusinessHours } = useBranches();

const weekdayLabels: Record<BranchWeekday, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const createInitialState = (): BranchMutationPayload => ({
  name: "",
  code: "",
  address: "",
  phone: "",
  settings: {
    businessHours: createDefaultBusinessHours(),
  },
});

const cloneBusinessHours = (source?: BranchBusinessHours): BranchBusinessHours => {
  const fallback = createDefaultBusinessHours();

  return weekdayOrder.reduce<BranchBusinessHours>((accumulator, day) => {
    const current = source?.[day] ?? fallback[day];
    accumulator[day] = {
      isOpen: current.isOpen,
      open: current.open,
      close: current.close,
    };
    return accumulator;
  }, createDefaultBusinessHours());
};

const state = reactive<BranchMutationPayload>(createInitialState());

watch(
  () => props.initialValue,
  (initialValue) => {
    state.name = initialValue?.name ?? "";
    state.code = initialValue?.code ?? "";
    state.address = initialValue?.address ?? "";
    state.phone = initialValue?.phone ?? "";
    state.settings = {
      businessHours: cloneBusinessHours(initialValue?.settings?.businessHours),
    };
  },
  { deep: true, immediate: true },
);

const businessHourDaySchema = z.object({
  isOpen: z.boolean(),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresa una hora válida."),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresa una hora válida."),
}).superRefine((value, context) => {
  if (value.isOpen && value.open >= value.close) {
    context.addIssue({
      code: "custom",
      path: ["close"],
      message: "La hora de cierre debe ser posterior a la apertura.",
    });
  }
});

const schema = z.object({
  name: z.string().trim().min(3, "El nombre de la sucursal es obligatorio."),
  code: z.string().trim().min(2, "El código debe tener al menos 2 caracteres.").max(12, "El código no puede superar 12 caracteres.").regex(/^[A-Za-z0-9-]+$/, "Usa solo letras, números y guiones."),
  address: z.string().trim().max(240, "La dirección no puede superar 240 caracteres."),
  phone: z.string().trim().max(32, "El teléfono no puede superar 32 caracteres."),
  settings: z.object({
    businessHours: z.object({
      monday: businessHourDaySchema,
      tuesday: businessHourDaySchema,
      wednesday: businessHourDaySchema,
      thursday: businessHourDaySchema,
      friday: businessHourDaySchema,
      saturday: businessHourDaySchema,
      sunday: businessHourDaySchema,
    }),
  }),
});

const resolvedSubmitLabel = computed(() => {
  if (props.submitLabel) {
    return props.submitLabel;
  }

  return props.mode === "create" ? "Crear sucursal" : "Guardar cambios";
});
</script>

<template>
  <div class="space-y-5">
    <UAlert
      v-if="limitMessage && mode === 'create'"
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Validación del plan"
      :description="limitMessage"
    />

    <UForm :schema="schema" :state="state" class="space-y-5" @submit="emits('submit', state)">
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Nombre" name="name">
          <UInput v-model="state.name" placeholder="Ej. Casa Matriz Centro" :disabled="loading" />
        </UFormField>

        <UFormField label="Código" name="code">
          <UInput v-model="state.code" placeholder="Ej. CTR-01" :disabled="loading" />
        </UFormField>

        <UFormField label="Dirección" name="address" class="md:col-span-2">
          <UInput v-model="state.address" placeholder="Dirección o referencia de la sucursal" :disabled="loading" />
        </UFormField>

        <UFormField label="Teléfono" name="phone">
          <UInput v-model="state.phone" placeholder="+591 70000000" :disabled="loading" />
        </UFormField>
      </div>

      <div class="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
        <div class="mb-4">
          <p class="text-sm font-semibold text-slate-950 dark:text-white">
            Horarios de atención
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Se almacenan dentro de <code>branches.settings.businessHours</code>.
          </p>
        </div>

        <div class="space-y-3">
          <div
            v-for="day in weekdayOrder"
            :key="day"
            class="grid items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60 md:grid-cols-[9rem_9rem_1fr_1fr]"
          >
            <div class="font-medium text-slate-950 dark:text-white">
              {{ weekdayLabels[day] }}
            </div>

            <UCheckbox
              v-model="state.settings.businessHours[day].isOpen"
              :label="state.settings.businessHours[day].isOpen ? 'Abierto' : 'Cerrado'"
              :disabled="loading"
            />

            <UInput
              v-model="state.settings.businessHours[day].open"
              type="time"
              :disabled="loading || !state.settings.businessHours[day].isOpen"
            />

            <UInput
              v-model="state.settings.businessHours[day].close"
              type="time"
              :disabled="loading || !state.settings.businessHours[day].isOpen"
            />
          </div>
        </div>
      </div>

      <div class="flex flex-wrap justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
          {{ cancelLabel }}
        </UButton>
        <UButton type="submit" color="primary" :loading="loading" :disabled="Boolean(limitMessage) && mode === 'create'">
          {{ resolvedSubmitLabel }}
        </UButton>
      </div>
    </UForm>
  </div>
</template>
