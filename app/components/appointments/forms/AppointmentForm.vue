<script setup lang="ts">
import { z } from "zod";

import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

import type {
  AppointmentBranchOption,
  AppointmentCustomerMode,
  AppointmentCustomerOption,
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
  customers: AppointmentCustomerOption[];
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

const { siatBillingEnabled, loadSiatBilling } = useSiatBilling();

interface AppointmentFormState {
  branchId: string;
  serviceId: string;
  employeeId: string;
  date: string;
  startTimeLocal: string;
  notes: string;
  reminderChannels: ReminderChannel[];
  customerMode: AppointmentCustomerMode;
  customerId: string;
  customerFullName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  billingName: string;
  billingEmail: string;
  billingPhone: string;
  documentType: "CI" | "NIT" | "Pasaporte" | "Otro" | null;
  documentNumber: string;
}

const customerModeOptions: Array<{ value: AppointmentCustomerMode; label: string; color: "neutral" | "primary" | "success" }> = [
  { value: "anonymous", label: "Cliente anonimo", color: "neutral" },
  { value: "registered", label: "Registrado", color: "primary" },
  { value: "new", label: "Nuevo cliente", color: "success" },
];

const defaultState = (): AppointmentFormState => ({
  branchId: props.branches[0]?.value ?? "",
  serviceId: props.services[0]?.value ?? "",
  employeeId: props.employees[0]?.value ?? "",
  date: "",
  startTimeLocal: "09:00",
  notes: "",
  reminderChannels: [],
  customerMode: "anonymous",
  customerId: "",
  customerFullName: "",
  customerPhone: "",
  customerLastName: "",
  customerEmail: "",
  billingName: "",
  billingEmail: "",
  billingPhone: "",
  documentType: null,
  documentNumber: "",
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
    state.customerMode = payload.initialValue?.customerMode ?? (payload.initialValue?.walkIn ? "new" : "anonymous");
    state.customerId = payload.initialValue?.customerId ?? "";
    state.customerFullName = payload.initialValue?.newCustomer?.fullName ?? payload.initialValue?.walkIn?.fullName ?? "";
    state.customerPhone = payload.initialValue?.newCustomer?.phone ?? payload.initialValue?.walkIn?.phone ?? "";
    state.customerLastName = payload.initialValue?.newCustomer?.lastName ?? "";
    state.customerEmail = payload.initialValue?.newCustomer?.email ?? "";
    state.billingName = payload.initialValue?.newCustomer?.billingName ?? "";
    state.billingEmail = payload.initialValue?.newCustomer?.billingEmail ?? "";
    state.billingPhone = payload.initialValue?.newCustomer?.billingPhone ?? "";
    state.documentType = payload.initialValue?.newCustomer?.documentType ?? null;
    state.documentNumber = payload.initialValue?.newCustomer?.documentNumber ?? "";
  },
  { immediate: true, deep: true },
);

const filteredEmployees = computed(() => {
  if (!state.branchId || !state.serviceId) {
    return props.employees;
  }

  return props.employees.filter((employee) => {
    const operatesInBranch = !employee.branchId
      || employee.branchId === state.branchId
      || employee.assignedBranchIds.includes(state.branchId);

    if (!operatesInBranch) {
      return false;
    }

    const skillsForBranch = employee.serviceIdsByBranch[state.branchId] ?? [];
    return skillsForBranch.includes(state.serviceId);
  });
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

watch(
  () => state.customerMode,
  (mode) => {
    if (mode !== "registered") {
      state.customerId = "";
    }

    if (mode !== "new") {
      state.customerFullName = "";
      state.customerLastName = "";
      state.customerPhone = "";
      state.customerEmail = "";
      state.billingName = "";
      state.billingEmail = "";
      state.billingPhone = "";
      state.documentType = null;
      state.documentNumber = "";
    }
  },
);

watch(
  () => siatBillingEnabled.value,
  (enabled) => {
    if (enabled) {
      return;
    }

    state.billingName = "";
    state.billingEmail = "";
    state.billingPhone = "";
    state.documentType = null;
    state.documentNumber = "";
  },
  { immediate: true },
);

onMounted(() => {
  loadSiatBilling();
});

const isCreateMode = computed(() => props.mode === "create");

const selectedService = computed(() => {
  return props.services.find((service) => service.value === state.serviceId) ?? null;
});

const selectedCustomer = computed(() => {
  return props.customers.find((customer) => customer.value === state.customerId) ?? null;
});

const documentTypeOptions: Array<{ label: string; value: "CI" | "NIT" | "Pasaporte" | "Otro" }> = [
  { label: "CI", value: "CI" },
  { label: "NIT", value: "NIT" },
  { label: "Pasaporte", value: "Pasaporte" },
  { label: "Otro", value: "Otro" },
];

const documentTypeModel = computed({
  get: () => state.documentType ?? undefined,
  set: (value: "CI" | "NIT" | "Pasaporte" | "Otro" | undefined) => {
    state.documentType = value ?? null;
  },
});

const schema = z.object({
  branchId: z.string().uuid("Selecciona una sucursal valida."),
  serviceId: z.string().uuid("Selecciona un servicio valido."),
  employeeId: z.string().uuid("Selecciona un colaborador valido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha valida."),
  startTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona una hora valida."),
  notes: z.string().trim().max(500, "Las notas no pueden superar 500 caracteres."),
  reminderChannels: z.array(z.enum(["email", "sms"] satisfies ReminderChannel[])),
  customerMode: z.enum(["anonymous", "registered", "new"] satisfies AppointmentCustomerMode[]),
  customerId: z.string(),
  customerFullName: z.string(),
  customerLastName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string(),
  billingName: z.string(),
  billingEmail: z.string(),
  billingPhone: z.string(),
  documentType: z.enum(["CI", "NIT", "Pasaporte", "Otro"]).nullable(),
  documentNumber: z.string(),
}).superRefine((value, context) => {
  if (!isCreateMode.value) {
    return;
  }

  if (value.customerMode === "registered" && value.customerId.trim().length === 0) {
    context.addIssue({
      code: "custom",
      path: ["customerId"],
      message: "Selecciona un cliente registrado.",
    });
  }

  if (value.customerMode === "new") {
    if (!props.allowWalkIn || props.mode !== "create") {
      context.addIssue({
        code: "custom",
        path: ["customerMode"],
        message: "La creacion de nuevo cliente no esta disponible en este flujo.",
      });
    }

    if (value.customerFullName.trim().length < 3) {
      context.addIssue({
        code: "custom",
        path: ["customerFullName"],
        message: "Ingresa el nombre del nuevo cliente.",
      });
    }

    if (value.customerPhone.trim().length < 7) {
      context.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "Ingresa un telefono valido para el nuevo cliente.",
      });
    }

    if (!value.customerPhone.trim() && !value.customerEmail.trim()) {
      context.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "Debes enviar al menos telefono o email.",
      });
    }

    if (value.customerEmail.trim().length > 0 && !z.string().email().safeParse(value.customerEmail.trim()).success) {
      context.addIssue({
        code: "custom",
        path: ["customerEmail"],
        message: "El email no es valido.",
      });
    }

    if (siatBillingEnabled.value && value.billingEmail.trim().length > 0 && !z.string().email().safeParse(value.billingEmail.trim()).success) {
      context.addIssue({
        code: "custom",
        path: ["billingEmail"],
        message: "El email de facturacion no es valido.",
      });
    }

    if (siatBillingEnabled.value && ((value.documentType && !value.documentNumber.trim()) || (value.documentNumber.trim() && !value.documentType))) {
      context.addIssue({
        code: "custom",
        path: value.documentType ? ["documentNumber"] : ["documentType"],
        message: "Tipo y numero de documento deben registrarse juntos.",
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
    customerMode: state.customerMode,
    customerId: state.customerMode === "registered" ? state.customerId : null,
    newCustomer: state.customerMode === "new"
      ? {
          fullName: state.customerFullName.trim(),
          phone: state.customerPhone.trim(),
          lastName: state.customerLastName.trim() || null,
          email: state.customerEmail.trim() || null,
          billingName: siatBillingEnabled.value ? (state.billingName.trim() || null) : null,
          billingEmail: siatBillingEnabled.value ? (state.billingEmail.trim() || null) : null,
          billingPhone: siatBillingEnabled.value ? (state.billingPhone.trim() || null) : null,
          documentType: siatBillingEnabled.value ? state.documentType : null,
          documentNumber: siatBillingEnabled.value ? (state.documentNumber.trim() || null) : null,
        }
      : null,
    walkIn: state.customerMode === "new"
      ? {
          fullName: state.customerFullName.trim(),
          phone: state.customerPhone.trim(),
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
      description="Selecciona sucursal, servicio, colaborador y horario de ejecucion."
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
            placeholder="Detalles utiles para operacion o atencion."
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
      v-if="isCreateMode"
      title="Cliente"
      description="Elige si la cita sera para el cliente anonimo, uno registrado o un nuevo cliente."
      :columns="1"
    >
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in customerModeOptions"
          :key="option.value"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm font-medium transition"
          :class="state.customerMode === option.value
            ? 'border-primary-500 bg-primary-500 text-white'
            : 'border-default text-highlighted hover:border-primary-300 hover:text-primary-600'"
          :disabled="loading"
          @click="state.customerMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <UAlert
        v-if="state.customerMode === 'anonymous'"
        color="neutral"
        variant="soft"
        icon="i-lucide-user-round"
        title="Cliente anonimo"
        description="La cita se registrara usando el cliente anonimo de la organizacion."
      />

      <AdminFieldGroup v-else-if="state.customerMode === 'registered'" :columns="1">
        <UFormField label="Cliente registrado" name="customerId">
          <USelect
            v-model="state.customerId"
            :items="customers"
            label-key="label"
            value-key="value"
            placeholder="Selecciona un cliente"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UAlert
          v-if="selectedCustomer"
          color="primary"
          variant="soft"
          icon="i-lucide-badge-check"
          :title="selectedCustomer.label"
          :description="selectedCustomer.phone || selectedCustomer.email || 'Cliente registrado listo para agendar.'"
        />
      </AdminFieldGroup>

      <AdminFieldGroup v-else :columns="2">
        <UFormField label="Nombre" name="customerFullName">
          <UInput v-model="state.customerFullName" placeholder="Ej. Maria" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Apellido" name="customerLastName">
          <UInput v-model="state.customerLastName" placeholder="Ej. Mendoza" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Telefono" name="customerPhone">
          <UInput v-model="state.customerPhone" placeholder="70000000" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Email" name="customerEmail">
          <UInput v-model="state.customerEmail" placeholder="cliente@correo.com" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <template v-if="siatBillingEnabled">
          <UFormField label="Razon social" name="billingName">
            <UInput v-model="state.billingName" placeholder="Ej. Comercial Mendoza SRL" :disabled="loading" :ui="ADMIN_FIELD_UI" />
          </UFormField>

          <UFormField label="Email facturacion" name="billingEmail">
            <UInput v-model="state.billingEmail" placeholder="facturacion@empresa.com" :disabled="loading" :ui="ADMIN_FIELD_UI" />
          </UFormField>

          <UFormField label="Telefono facturacion" name="billingPhone" class="sm:col-span-2">
            <UInput v-model="state.billingPhone" placeholder="Telefono para comprobantes" :disabled="loading" :ui="ADMIN_FIELD_UI" />
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
            <UInput v-model="state.documentNumber" placeholder="Ej. 12345678 o 1020304011" :disabled="loading" :ui="ADMIN_FIELD_UI" />
          </UFormField>
        </template>
      </AdminFieldGroup>
    </AdminFormSection>

    <AdminFormSection
      title="Recordatorios"
      description="Define la intencion de notificacion para integraciones de email y SMS."
      :columns="1"
    >
      <UAlert
        color="neutral"
        variant="soft"
        icon="i-lucide-bell-ring"
        title="Integracion pendiente"
        description="Se guarda la intencion del canal para conectarlo luego con email o SMS."
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

    <div
      v-if="selectedService"
      class="rounded-[1.5rem] border border-primary-200 bg-primary-50/60 p-4 text-sm text-primary-900 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-100"
    >
      La duracion estimada para <span class="font-semibold">{{ selectedService.label }}</span> es de
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
