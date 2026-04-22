<script setup lang="ts">
import type {
  AppointmentCalendarView,
  AppointmentListItem,
  AppointmentCatalog,
  AppointmentMutationPayload,
  AppointmentScopeRole,
} from "@/composables/useAppointments";

const props = defineProps<{
  scopeRole: AppointmentScopeRole;
  title: string;
  eyebrow: string;
  description: string;
}>();

const {
  createDefaultFilters,
  loadAppointments,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  updateAppointmentStatus,
  appointmentStatusOptions,
  formatDateTime,
  formatTimeRange,
  getAppointmentStatusLabel,
  getAppointmentColor,
  toFormPayloadFromAppointment,
  localTimeZone,
} = useAppointments();

const { profile } = useAuth();

const createEmptyCatalog = (): AppointmentCatalog => ({
  organizationId: "",
  branches: [],
  services: [],
  employees: [],
});

const filters = reactive(createDefaultFilters());
const createOpen = ref(false);
const editOpen = ref(false);
const cancelOpen = ref(false);
const mutationLoading = ref(false);
const feedback = ref<{ color: "success" | "error"; title: string; description: string } | null>(null);
const selectedAppointment = ref<AppointmentListItem | null>(null);
const formPreset = ref<Partial<AppointmentMutationPayload> | undefined>(undefined);

const asyncKey = computed(() => `appointments-workspace:${props.scopeRole}:${filters.view}:${filters.anchorDate}:${filters.branchId ?? "all"}:${filters.employeeId ?? "all"}:${filters.serviceId ?? "all"}:${filters.status}`);

const { data, pending, refresh } = await useAsyncData(
  asyncKey,
  () => loadAppointments(props.scopeRole, { ...filters }),
  {
    server: false,
    lazy: false,
    watch: [
      () => filters.view,
      () => filters.anchorDate,
      () => filters.branchId,
      () => filters.employeeId,
      () => filters.serviceId,
      () => filters.status,
    ],
  },
);

const catalog = computed(() => data.value?.catalog ?? createEmptyCatalog());
const appointments = computed(() => data.value?.appointments ?? []);

const filteredEmployeeOptions = computed(() => {
  const branchId = filters.branchId;
  const serviceId = filters.serviceId;

  return catalog.value.employees.filter((employee) => {
    if (!branchId) {
      return true;
    }

    const operatesInBranch =
      !employee.branchId
      || employee.branchId === branchId
      || employee.assignedBranchIds.includes(branchId);

    if (!operatesInBranch) {
      return false;
    }

    if (!serviceId) {
      return true;
    }

    const skillsForBranch = employee.serviceIdsByBranch[branchId] ?? [];
    return skillsForBranch.includes(serviceId);
  });
});

watch(
  () => filteredEmployeeOptions.value,
  (employees) => {
    if (filters.employeeId && !employees.some((employee) => employee.value === filters.employeeId)) {
      filters.employeeId = null;
    }
  },
  { immediate: true },
);

const allowWalkIn = computed(() => props.scopeRole !== "client");
const canMutateStatuses = computed(() => props.scopeRole === "manager" || props.scopeRole === "employee");

const summary = computed(() => {
  const allAppointments = appointments.value;
  return {
    total: allAppointments.length,
    active: allAppointments.filter((appointment) => ["pending", "confirmed", "in_progress"].includes(appointment.status)).length,
    completed: allAppointments.filter((appointment) => appointment.status === "completed").length,
    walkIns: allAppointments.filter((appointment) => appointment.isWalkIn).length,
  };
});

const contextItems = computed(() => [
  { label: "Usuario", value: profile.value?.full_name ?? "Sin perfil" },
  { label: "Rol", value: profile.value?.role ?? "Sin rol" },
  { label: "Sucursal base", value: filters.branchId ? (catalog.value.branches.find((branch) => branch.value === filters.branchId)?.label ?? "No restringida") : "No restringida" },
  { label: "Servicios visibles", value: catalog.value.services.length },
  { label: "Colaboradores visibles", value: catalog.value.employees.length },
]);

const openCreateModal = (payload?: { date: string; hour?: string }) => {
  feedback.value = null;
  formPreset.value = {
    branchId: filters.branchId ?? catalog.value.branches[0]?.value ?? "",
    employeeId: filters.employeeId ?? catalog.value.employees[0]?.value ?? "",
    serviceId: filters.serviceId ?? catalog.value.services[0]?.value ?? "",
    date: payload?.date ?? filters.anchorDate,
    startTimeLocal: payload?.hour ?? "09:00",
    notes: "",
    reminderChannels: [],
    walkIn: null,
  };
  createOpen.value = true;
};

const openEditModal = (appointment: AppointmentListItem) => {
  selectedAppointment.value = appointment;
  formPreset.value = toFormPayloadFromAppointment(appointment);
  editOpen.value = true;
  feedback.value = null;
};

const closeFormModals = () => {
  createOpen.value = false;
  editOpen.value = false;
  formPreset.value = undefined;
};

const setFeedbackFromError = (title: string, error: unknown) => {
  feedback.value = {
    color: "error",
    title,
    description: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
  };
};

const handleCreate = async (payload: AppointmentMutationPayload) => {
  mutationLoading.value = true;

  try {
    await createAppointment(payload);
    closeFormModals();
    await refresh();
    feedback.value = {
      color: "success",
      title: "Cita creada",
      description: "La agenda se actualizó y la disponibilidad quedó recalculada.",
    };
  } catch (error) {
    setFeedbackFromError("No se pudo crear la cita", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleUpdate = async (payload: AppointmentMutationPayload) => {
  if (!selectedAppointment.value) {
    return;
  }

  mutationLoading.value = true;

  try {
    await updateAppointment(selectedAppointment.value.id, payload);
    closeFormModals();
    await refresh();
    feedback.value = {
      color: "success",
      title: "Cita actualizada",
      description: "La cita fue reagendada y la agenda quedó sincronizada.",
    };
  } catch (error) {
    setFeedbackFromError("No se pudo actualizar la cita", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleCancel = async (reason: string) => {
  if (!selectedAppointment.value) {
    return;
  }

  mutationLoading.value = true;

  try {
    await cancelAppointment(selectedAppointment.value.id, reason);
    cancelOpen.value = false;
    await refresh();
    feedback.value = {
      color: "success",
      title: "Cita cancelada",
      description: "La cancelación quedó registrada con motivo para auditoría.",
    };
  } catch (error) {
    setFeedbackFromError("No se pudo cancelar la cita", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleStatusUpdate = async (status: "in_progress" | "completed") => {
  if (!selectedAppointment.value) {
    return;
  }

  mutationLoading.value = true;

  try {
    await updateAppointmentStatus(selectedAppointment.value.id, { status });
    await refresh();
    feedback.value = {
      color: "success",
      title: status === "in_progress" ? "Check-in realizado" : "Cita completada",
      description: status === "in_progress"
        ? "La cita pasó a estado En proceso."
        : "La cita quedó marcada como completada.",
    };
  } catch (error) {
    setFeedbackFromError("No se pudo actualizar el estado", error);
  } finally {
    mutationLoading.value = false;
  }
};

const selectedAppointmentLabel = computed(() => {
  if (!selectedAppointment.value) {
    return "la cita seleccionada";
  }

  return `${selectedAppointment.value.customerName} · ${selectedAppointment.value.serviceName}`;
});

const selectableStatuses = computed(() => {
  return appointmentStatusOptions.filter((option) => option.value !== "all");
});

const clearSelectedAppointment = () => {
  selectedAppointment.value = null;
};

const changeView = (view: AppointmentCalendarView) => {
  filters.view = view;
};
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiPageHeader :eyebrow="eyebrow" :title="title" :description="description">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-refresh-cw" class="min-h-11 justify-center" :loading="pending" @click="refresh()">
          Recargar
        </UButton>
        <UButton color="primary" icon="i-lucide-plus" class="min-h-11 justify-center" @click="openCreateModal()">
          Nueva cita
        </UButton>
      </template>
    </UiPageHeader>

    <UAlert
      v-if="feedback"
      :color="feedback.color"
      variant="soft"
      icon="i-lucide-badge-info"
      :title="feedback.title"
      :description="feedback.description"
    />

    <UiKpiStrip
      :items="[
        { label: 'Total rango', value: summary.total, icon: 'i-lucide-calendar-range', tone: 'slate' },
        { label: 'Activas', value: summary.active, icon: 'i-lucide-calendar-clock', tone: 'sky' },
        { label: 'Completadas', value: summary.completed, icon: 'i-lucide-badge-check', tone: 'emerald' },
        { label: 'Walk-in', value: summary.walkIns, icon: 'i-lucide-user-round-plus', tone: 'amber' },
      ]"
      columns-class="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
    />

    <UiSearchFilters
      title="Filtros de agenda"
      description="Ajusta la vista, el rango y los responsables sin perder el contexto operativo."
      surface
    >
      <template #controls>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Vista
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="filters.view" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Fecha base
        </label>
        <UInput v-model="filters.anchorDate" type="date" :ui="{ base: 'min-h-11 text-base' }" />
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Sucursal
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="filters.branchId" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option :value="null">Todas</option>
            <option v-for="branch in catalog.branches" :key="branch.value" :value="branch.value">
              {{ branch.label }}
            </option>
          </select>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Empleado
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="filters.employeeId" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option :value="null">Todos</option>
            <option v-for="employee in filteredEmployeeOptions" :key="employee.value" :value="employee.value">
              {{ employee.label }}
            </option>
          </select>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Estado
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="filters.status" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option value="all">Todos</option>
            <option v-for="status in selectableStatuses" :key="status.value" :value="status.value">
              {{ status.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="md:col-span-2 xl:col-span-5">
        <label class="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Servicio
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="filters.serviceId" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option :value="null">Todos</option>
            <option v-for="service in catalog.services" :key="service.value" :value="service.value">
              {{ service.label }}
            </option>
          </select>
        </div>
      </div>
        </div>
      </template>

      <template #summary>
        {{ appointments.length }} cita<span v-if="appointments.length !== 1">s</span> visibles
      </template>
    </UiSearchFilters>

    <section class="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <FeaturesAppointmentCalendar
        :appointments="appointments"
        :view="filters.view"
        :selected-date="filters.anchorDate"
        :loading="pending"
        :timezone="localTimeZone"
        @update:view="changeView"
        @update:selected-date="filters.anchorDate = $event"
        @select-slot="openCreateModal"
        @select-appointment="selectedAppointment = $event"
      />

      <div class="space-y-4">
        <UiSectionShell
          title="Detalle de cita"
          description="Selecciona una tarjeta del calendario para revisar o actuar."
        >
          <template #actions>
            <UButton
              v-if="selectedAppointment"
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="min-h-10 justify-center self-start"
              @click="clearSelectedAppointment"
            >
              Limpiar
            </UButton>
          </template>

          <div v-if="selectedAppointment" class="space-y-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <p class="text-lg font-semibold text-slate-950 dark:text-white">
                  {{ selectedAppointment.customerName }}
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400 sm:pr-4">
                  {{ selectedAppointment.serviceName }} · {{ selectedAppointment.branchName }}
                </p>
              </div>
              <UBadge :color="getAppointmentColor(selectedAppointment.status)" variant="soft" class="self-start">
                {{ getAppointmentStatusLabel(selectedAppointment.status) }}
              </UBadge>
            </div>

            <div class="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p><span class="font-medium text-slate-950 dark:text-white">Horario:</span> {{ formatTimeRange(selectedAppointment.startTime, selectedAppointment.endTime) }}</p>
              <p><span class="font-medium text-slate-950 dark:text-white">Fecha:</span> {{ formatDateTime(selectedAppointment.startTime, { dateStyle: 'full', timeStyle: undefined }) }}</p>
              <p><span class="font-medium text-slate-950 dark:text-white">Empleado:</span> {{ selectedAppointment.employeeName }}</p>
              <p><span class="font-medium text-slate-950 dark:text-white">Contacto:</span> {{ selectedAppointment.customerPhone ?? 'Sin teléfono' }}</p>
              <p><span class="font-medium text-slate-950 dark:text-white">Tipo:</span> {{ selectedAppointment.isWalkIn ? 'Walk-in' : 'Cliente registrado' }}</p>
              <p v-if="selectedAppointment.notes"><span class="font-medium text-slate-950 dark:text-white">Notas:</span> {{ selectedAppointment.notes }}</p>
              <p v-if="selectedAppointment.cancellationReason"><span class="font-medium text-slate-950 dark:text-white">Motivo cancelación:</span> {{ selectedAppointment.cancellationReason }}</p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-pencil-line"
                block
                class="min-h-11 sm:w-auto"
                :disabled="selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'completed'"
                @click="openEditModal(selectedAppointment)"
              >
                Editar
              </UButton>

              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-ban"
                block
                class="min-h-11 sm:w-auto"
                :disabled="selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'completed'"
                @click="cancelOpen = true"
              >
                Cancelar
              </UButton>

              <UButton
                v-if="canMutateStatuses && ['pending', 'confirmed'].includes(selectedAppointment.status)"
                color="warning"
                variant="soft"
                icon="i-lucide-play-circle"
                block
                class="min-h-11 sm:w-auto"
                :loading="mutationLoading"
                @click="handleStatusUpdate('in_progress')"
              >
                Check-in
              </UButton>

              <UButton
                v-if="canMutateStatuses && selectedAppointment.status === 'in_progress'"
                color="success"
                variant="soft"
                icon="i-lucide-badge-check"
                block
                class="min-h-11 sm:w-auto"
                :loading="mutationLoading"
                @click="handleStatusUpdate('completed')"
              >
                Completar
              </UButton>
            </div>
          </div>

          <UAlert
            v-else
            color="neutral"
            variant="soft"
            icon="i-lucide-calendar-search"
            title="Sin cita seleccionada"
            description="Cuando elijas una cita desde la agenda verás aquí sus datos, acciones y trazabilidad."
          />
        </UiSectionShell>

        <UiSectionShell
          title="Contexto operativo"
          :description="`La hora se muestra en tu zona local: ${localTimeZone}.`"
        >
          <UiContextList :items="contextItems" />
        </UiSectionShell>
      </div>
    </section>

    <UModal
      :open="createOpen"
      title="Crear cita"
      description="Selecciona servicio, colaborador y horario validando disponibilidad en tiempo real."
      @update:open="createOpen = $event"
    >
      <template #body>
        <FormsAppointmentForm
          mode="create"
          :loading="mutationLoading"
          :allow-walk-in="allowWalkIn"
          :initial-value="formPreset"
          :branches="catalog.branches"
          :services="catalog.services"
          :employees="catalog.employees"
          @cancel="closeFormModals"
          @submit="handleCreate"
        />
      </template>
    </UModal>

    <UModal
      :open="editOpen"
      title="Editar cita"
      description="Reagenda o ajusta servicio y empleado respetando solapamientos."
      @update:open="editOpen = $event"
    >
      <template #body>
        <FormsAppointmentForm
          mode="edit"
          :loading="mutationLoading"
          :allow-walk-in="false"
          :initial-value="formPreset"
          :branches="catalog.branches"
          :services="catalog.services"
          :employees="catalog.employees"
          submit-label="Guardar cita"
          @cancel="closeFormModals"
          @submit="handleUpdate"
        />
      </template>
    </UModal>

    <ModalsAppointmentCancel
      :open="cancelOpen"
      :loading="mutationLoading"
      :appointment-label="selectedAppointmentLabel"
      @update:open="cancelOpen = $event"
      @submit="handleCancel"
    />
  </div>
</template>
