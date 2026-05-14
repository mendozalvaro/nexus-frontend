<script setup lang="ts">
import { z } from "zod";

import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

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
    const operatesInBranch
      = !employee.branchId
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
    <AdminFormSection
      title="Agenda de la cita"
      description="Selecciona sucursal, servicio, colaborador y horario de ejecución."
      :columns="2"
    >
      <AdminFieldGroup :columns="2" class="sm:col-span-2">
        <UFormField label="Sucursal" name="branchId">
          <USelect
            v-model="state.branchId"
            :items="branches"
            label-key="label"
            value-key="value"
            placeholder="Selecciona una sucursal"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Servicio" name="serviceId">
          <USelect
            v-model="state.serviceId"
            :items="services"
            label-key="label"
            value-key="value"
            placeholder="Selecciona un servicio"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Empleado" name="employeeId">
          <USelect
            v-model="state.employeeId"
            :items="filteredEmployees"
            label-key="label"
            value-key="value"
            placeholder="Selecciona un empleado"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Fecha" name="date">
          <UInput v-model="state.date" type="date" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Hora de inicio" name="startTimeLocal">
          <UInput v-model="state.startTimeLocal" type="time" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Notas internas" name="notes" class="sm:col-span-2">
          <UTextarea
            v-model="state.notes"
            :rows="4"
            placeholder="Detalles útiles para operación o atención."
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>
      </AdminFieldGroup>

      <div v-if="state.branchId && state.serviceId && filteredEmployees.length === 0" class="sm:col-span-2">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-alert-triangle"
          title="Sin cobertura para este servicio"
          description="No hay colaboradores asignados al servicio en la sucursal seleccionada."
        />
      </div>
    </AdminFormSection>

    <AdminFormSection
      title="Recordatorios"
      description="Define la intención de notificación para integraciones de email y SMS."
      :columns="1"
    >
      <UAlert
        color="neutral"
        variant="soft"
        icon="i-lucide-bell-ring"
        title="Integración pendiente"
        description="Se guarda la intención del canal para conectarlo luego con email o SMS."
      />

      <div class="flex flex-wrap gap-4">
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
    </AdminFormSection>

    <AdminFormSection
      v-if="allowWalkIn && mode === 'create'"
      title="Walk-in"
      description="Crea una cita rápida con un cliente temporal sin cuenta asociada."
      :columns="1"
    >
      <UCheckbox v-model="state.walkInEnabled" label="Activar walk-in" :disabled="loading" />

      <AdminFieldGroup v-if="state.walkInEnabled" :columns="2">
        <UFormField label="Nombre del cliente" name="walkInFullName">
          <UInput v-model="state.walkInFullName" placeholder="Ej. Cliente de paso" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Teléfono" name="walkInPhone">
          <UInput v-model="state.walkInPhone" placeholder="+591 70000000" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <div
      v-if="selectedService"
      class="rounded-[1.5rem] border border-primary-200 bg-primary-50/60 p-4 text-sm text-primary-900 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-100"
    >
      La duración estimada para <span class="font-semibold">{{ selectedService.label }}</span> es de
      <span class="font-semibold">{{ selectedService.durationMinutes }} minutos</span>.
    </div>

    <AdminFormActions>
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading">
        {{ resolvedSubmitLabel }}
      </UButton>
    </AdminFormActions>
  </UForm>
</template>
