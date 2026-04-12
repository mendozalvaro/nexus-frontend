<script setup lang="ts">
import { z } from "zod";

import type {
  AppointmentBranchOption,
  AppointmentEmployeeOption,
  AppointmentMutationPayload,
  AppointmentServiceOption,
  ReminderChannel,
} from "@/composables/useAppointments";

const props = withDefaults(defineProps<{
  mode: "create" | "edit";
  loading?: boolean;
  allowWalkIn?: boolean;
  initialValue?: Partial<AppointmentMutationPayload>;
  branches: AppointmentBranchOption[];
  services: AppointmentServiceOption[];
  employees: AppointmentEmployeeOption[];
  submitLabel?: string;
}>(), {
  loading: false,
  allowWalkIn: false,
  initialValue: () => ({}),
  submitLabel: undefined,
});

const emits = defineEmits<{
  submit: [AppointmentMutationPayload];
  cancel: [];
}>();

interface AppointmentFormState {
  branchId: string;
  serviceId: string;
  employeeId: string;
  date: string;
  startTimeLocal: string;
  notes: string;
  reminderChannels: ReminderChannel[];
  walkInEnabled: boolean;
  walkInFullName: string;
  walkInPhone: string;
}

const defaultState = (): AppointmentFormState => ({
  branchId: props.branches[0]?.value ?? "",
  serviceId: props.services[0]?.value ?? "",
  employeeId: props.employees[0]?.value ?? "",
  date: "",
  startTimeLocal: "09:00",
  notes: "",
  reminderChannels: [],
  walkInEnabled: false,
  walkInFullName: "",
  walkInPhone: "",
});

const state = reactive<AppointmentFormState>(defaultState());

watch(
  () => ({
    initialValue: props.initialValue,
    branchId: props.branches[0]?.value ?? "",
    serviceId: props.services[0]?.value ?? "",
    employeeId: props.employees[0]?.value ?? "",
  }),
  (payload) => {
    state.branchId = payload.initialValue?.branchId ?? payload.branchId;
    state.serviceId = payload.initialValue?.serviceId ?? payload.serviceId;
    state.employeeId = payload.initialValue?.employeeId ?? payload.employeeId;
    state.date = payload.initialValue?.date ?? "";
    state.startTimeLocal = payload.initialValue?.startTimeLocal ?? "09:00";
    state.notes = payload.initialValue?.notes ?? "";
    state.reminderChannels = [...(payload.initialValue?.reminderChannels ?? [])];
    state.walkInEnabled = Boolean(payload.initialValue?.walkIn && props.mode === "create");
    state.walkInFullName = payload.initialValue?.walkIn?.fullName ?? "";
    state.walkInPhone = payload.initialValue?.walkIn?.phone ?? "";
  },
  { immediate: true, deep: true },
);

const filteredEmployees = computed(() => {
  if (!state.branchId || !state.serviceId) {
    return props.employees;
  }

  const branchEmployees = props.employees.filter((employee) => {
    const operatesInBranch =
      !employee.branchId
      || employee.branchId === state.branchId
      || employee.assignedBranchIds.includes(state.branchId);

    if (!operatesInBranch) {
      return false;
    }

    const skillsForBranch = employee.serviceIdsByBranch[state.branchId] ?? [];
    return skillsForBranch.includes(state.serviceId);
  });

  return branchEmployees;
});

watch(
  () => filteredEmployees.value,
  (employees) => {
    if (!employees.some((employee) => employee.value === state.employeeId)) {
      state.employeeId = employees[0]?.value ?? "";
    }
  },
  { immediate: true },
);

const selectedService = computed(() => {
  return props.services.find((service) => service.value === state.serviceId) ?? null;
});

const schema = z.object({
  branchId: z.string().uuid("Selecciona una sucursal válida."),
  serviceId: z.string().uuid("Selecciona un servicio válido."),
  employeeId: z.string().uuid("Selecciona un colaborador válido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida."),
  startTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona una hora válida."),
  notes: z.string().trim().max(500, "Las notas no pueden superar 500 caracteres."),
  reminderChannels: z.array(z.enum(["email", "sms"] satisfies ReminderChannel[])),
  walkInEnabled: z.boolean(),
  walkInFullName: z.string(),
  walkInPhone: z.string(),
}).superRefine((value, context) => {
  if (value.walkInEnabled) {
    if (!props.allowWalkIn || props.mode !== "create") {
      context.addIssue({
        code: "custom",
        path: ["walkInEnabled"],
        message: "El modo walk-in no está disponible en este flujo.",
      });
    }

    if (value.walkInFullName.trim().length < 3) {
      context.addIssue({
        code: "custom",
        path: ["walkInFullName"],
        message: "Ingresa el nombre del walk-in.",
      });
    }

    if (value.walkInPhone.trim().length < 7) {
      context.addIssue({
        code: "custom",
        path: ["walkInPhone"],
        message: "Ingresa un teléfono válido para el walk-in.",
      });
    }
  }
});

const resolvedSubmitLabel = computed(() => {
  if (props.submitLabel) {
    return props.submitLabel;
  }

  return props.mode === "create" ? "Crear cita" : "Guardar cambios";
});

const submit = () => {
  emits("submit", {
    branchId: state.branchId,
    serviceId: state.serviceId,
    employeeId: state.employeeId,
    date: state.date,
    startTimeLocal: state.startTimeLocal,
    notes: state.notes,
    reminderChannels: [...state.reminderChannels],
    walkIn: state.walkInEnabled
      ? {
          fullName: state.walkInFullName.trim(),
          phone: state.walkInPhone.trim(),
        }
      : null,
  });
};

const toggleReminder = (channel: ReminderChannel, checked: boolean | "indeterminate") => {
  if (checked !== true) {
    state.reminderChannels = state.reminderChannels.filter((item) => item !== channel);
    return;
  }

  if (!state.reminderChannels.includes(channel)) {
    state.reminderChannels = [...state.reminderChannels, channel];
  }
};
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-5" @submit="submit">
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField label="Sucursal" name="branchId">
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="state.branchId" class="w-full bg-transparent outline-none" :disabled="loading">
            <option value="">Selecciona una sucursal</option>
            <option v-for="branch in branches" :key="branch.value" :value="branch.value">
              {{ branch.label }}
            </option>
          </select>
        </div>
      </UFormField>

      <UFormField label="Servicio" name="serviceId">
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="state.serviceId" class="w-full bg-transparent outline-none" :disabled="loading">
            <option value="">Selecciona un servicio</option>
            <option v-for="service in services" :key="service.value" :value="service.value">
              {{ service.label }} · {{ service.durationMinutes }} min
            </option>
          </select>
        </div>
      </UFormField>

      <UFormField label="Empleado" name="employeeId">
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="state.employeeId" class="w-full bg-transparent outline-none" :disabled="loading">
            <option value="">Selecciona un empleado</option>
            <option v-for="employee in filteredEmployees" :key="employee.value" :value="employee.value">
              {{ employee.label }}
            </option>
          </select>
        </div>
      </UFormField>

      <div v-if="state.branchId && state.serviceId && filteredEmployees.length === 0" class="md:col-span-2">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-alert-triangle"
          title="Sin cobertura para este servicio"
          description="No hay colaboradores asignados al servicio en la sucursal seleccionada."
        />
      </div>

      <UFormField label="Fecha" name="date">
        <UInput v-model="state.date" type="date" :disabled="loading" />
      </UFormField>

      <UFormField label="Hora de inicio" name="startTimeLocal">
        <UInput v-model="state.startTimeLocal" type="time" :disabled="loading" />
      </UFormField>

      <UFormField label="Notas internas" name="notes" class="md:col-span-2">
        <UTextarea v-model="state.notes" :rows="4" placeholder="Detalles útiles para operación o atención." :disabled="loading" />
      </UFormField>
    </div>

    <div class="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-950 dark:text-white">
            Recordatorios
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Placeholder listo para integrar email y SMS más adelante.
          </p>
        </div>

        <UAlert
          color="neutral"
          variant="soft"
          icon="i-lucide-bell-ring"
          title="Integración pendiente"
          description="Se guarda la intención del canal para conectarlo luego con email/SMS."
        />
      </div>

      <div class="mt-4 flex flex-wrap gap-4">
        <UCheckbox
          :model-value="state.reminderChannels.includes('email')"
          label="Email"
          :disabled="loading"
          @update:model-value="toggleReminder('email', $event)"
        />
        <UCheckbox
          :model-value="state.reminderChannels.includes('sms')"
          label="SMS"
          :disabled="loading"
          @update:model-value="toggleReminder('sms', $event)"
        />
      </div>
    </div>

    <div v-if="allowWalkIn && mode === 'create'" class="rounded-[1.5rem] border border-slate-200 p-4 dark:border-slate-800">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-slate-950 dark:text-white">
            Walk-in
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Crea una cita rápida con un cliente temporal sin cuenta de usuario.
          </p>
        </div>

        <UCheckbox v-model="state.walkInEnabled" label="Activar walk-in" :disabled="loading" />
      </div>

      <div v-if="state.walkInEnabled" class="mt-4 grid gap-4 md:grid-cols-2">
        <UFormField label="Nombre del cliente" name="walkInFullName">
          <UInput v-model="state.walkInFullName" placeholder="Ej. Cliente de paso" :disabled="loading" />
        </UFormField>

        <UFormField label="Teléfono" name="walkInPhone">
          <UInput v-model="state.walkInPhone" placeholder="+591 70000000" :disabled="loading" />
        </UFormField>
      </div>
    </div>

    <div
      v-if="selectedService"
      class="rounded-[1.5rem] border border-primary-200 bg-primary-50/60 p-4 text-sm text-primary-900 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-100"
    >
      La duración estimada para <span class="font-semibold">{{ selectedService.label }}</span> es de
      <span class="font-semibold">{{ selectedService.durationMinutes }} minutos</span>.
    </div>

    <div class="flex flex-wrap justify-end gap-3">
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ resolvedSubmitLabel }}
      </UButton>
    </div>
  </UForm>
</template>
