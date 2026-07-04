<script setup lang="ts">
import type { AppointmentDashboardResult, AppointmentDashboardScopeRole } from "@/composables/useAppointmentDashboard";
import type { AppointmentBranchOption, AppointmentServiceOption, AppointmentEmployeeOption, AppointmentCustomerOption, AppointmentListItem, AppointmentMutationPayload } from "@/composables/useAppointments";
import type { AppointmentTab } from "@/components/appointments/AppointmentTabs.vue";
import type { POSReceipt } from "@/composables/usePOS";
import AppointmentTabs from "@/components/appointments/AppointmentTabs.vue";
import AppointmentSummaryPanel from "@/components/appointments/AppointmentSummaryPanel.vue";
import AppointmentToolbar from "@/components/appointments/AppointmentToolbar.vue";
import AppointmentKanbanBoard from "@/components/appointments/AppointmentKanbanBoard.vue";
import AppointmentForm from "@/components/appointments/forms/AppointmentForm.vue";
import AppointmentCancelModal from "@/components/appointments/modals/AppointmentCancelModal.vue";
import ReceiptViewer from "@/components/pos/modals/ReceiptViewer.vue";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "appointments.view",
  roles: ["admin", "manager", "employee"],
  moduleKey: "appointments",
});

const { profile } = useAuth();
const { loadDashboard, getManagerBranchId, scopeRole } = useAppointmentDashboard();
const {
  loadCatalog,
  loadAppointments,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  updateAppointmentStatus,
  toFormPayloadFromAppointment,
} = useAppointments();
const { loadReceipt } = usePOS();

const activeTab = ref<AppointmentTab>("resumen");
const dashboardDate = ref(new Date().toISOString().slice(0, 10));
const listDate = ref(new Date().toISOString().slice(0, 10));

const dashboardData = ref<AppointmentDashboardResult | null>(null);
const dashboardLoading = ref(false);

const catalog = ref<{
  branches: AppointmentBranchOption[];
  services: AppointmentServiceOption[];
  employees: AppointmentEmployeeOption[];
  customers: AppointmentCustomerOption[];
}>({ branches: [], services: [], employees: [], customers: [] });
const catalogLoaded = ref(false);

const appointments = ref<AppointmentListItem[]>([]);
const listLoading = ref(false);
const mutationLoading = ref(false);
const mutationError = ref<string | null>(null);

const createOpen = ref(false);
const editOpen = ref(false);
const cancelOpen = ref(false);
const editingAppointment = ref<AppointmentListItem | null>(null);
const formPreset = ref<Partial<AppointmentMutationPayload> | undefined>(undefined);
const receiptOpen = ref(false);
const receiptData = ref<POSReceipt | null>(null);
const receiptLoading = ref(false);

const loadCatalogForList = async () => {
  if (catalogLoaded.value) return;
  try {
    const catalogScope = scopeRole.value === "admin" ? "manager" : scopeRole.value;
    const result = await loadCatalog(catalogScope as "manager" | "employee");
    catalog.value = {
      branches: result.branches,
      services: result.services,
      employees: result.employees,
      customers: result.customers,
    };
    catalogLoaded.value = true;
  } catch {
    // Catalog load failure - list tab will handle gracefully
  }
};

const loadDashboardData = async () => {
  dashboardLoading.value = true;
  try {
    dashboardData.value = await loadDashboard(
      dashboardDate.value,
      scopeRole.value as AppointmentDashboardScopeRole,
      profile.value?.id ?? "",
      getManagerBranchId.value,
    );
  } catch {
    dashboardData.value = null;
  } finally {
    dashboardLoading.value = false;
  }
};

const loadDayAppointments = async () => {
  listLoading.value = true;
  try {
    const scopeForList = scopeRole.value === "admin" ? "manager" : scopeRole.value;
    const result = await loadAppointments(scopeForList as "manager" | "employee", {
      view: "day",
      anchorDate: listDate.value,
      branchId: getManagerBranchId.value,
      employeeId: null,
      serviceId: null,
      status: "all",
    });
    appointments.value = result.appointments;
  } catch {
    appointments.value = [];
  } finally {
    listLoading.value = false;
  }
};

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "statusMessage" in error && typeof (error as { statusMessage?: unknown }).statusMessage === "string") {
    return (error as { statusMessage: string }).statusMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const openCreateModal = () => {
  formPreset.value = {
    branchId: catalog.value.branches[0]?.value ?? "",
    employeeId: catalog.value.employees[0]?.value ?? "",
    serviceId: catalog.value.services[0]?.value ?? "",
    date: listDate.value,
    startTimeLocal: "09:00",
    notes: "",
    reminderChannels: [],
    customerMode: "anonymous",
    customerId: null,
    newCustomer: null,
    walkIn: null,
  };
  createOpen.value = true;
};

const openEditModal = (appointment: AppointmentListItem) => {
  editingAppointment.value = appointment;
  formPreset.value = toFormPayloadFromAppointment(appointment);
  editOpen.value = true;
};

const closeFormModals = () => {
  createOpen.value = false;
  editOpen.value = false;
  formPreset.value = undefined;
  editingAppointment.value = null;
};

const handleCreateSubmit = async (payload: AppointmentMutationPayload) => {
  mutationLoading.value = true;
  mutationError.value = null;
  try {
    await createAppointment(payload);
    closeFormModals();
    await loadDayAppointments();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo crear la cita.");
    console.error("[APPOINTMENTS] Create failed:", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleUpdateSubmit = async (payload: AppointmentMutationPayload) => {
  if (!editingAppointment.value) return;
  mutationLoading.value = true;
  mutationError.value = null;
  try {
    await updateAppointment(editingAppointment.value.id, payload);
    closeFormModals();
    await loadDayAppointments();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo actualizar la cita.");
    console.error("[APPOINTMENTS] Update failed:", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleCancelSubmit = async (reason: string) => {
  if (!editingAppointment.value) return;
  mutationLoading.value = true;
  mutationError.value = null;
  try {
    await cancelAppointment(editingAppointment.value.id, reason);
    cancelOpen.value = false;
    await loadDayAppointments();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo cancelar la cita.");
    console.error("[APPOINTMENTS] Cancel failed:", error);
  } finally {
    mutationLoading.value = false;
  }
};

const handleToggleStatus = async (appointment: AppointmentListItem, status: "in_progress" | "completed") => {
  mutationError.value = null;
  try {
    await updateAppointmentStatus(appointment.id, { status });
    await loadDayAppointments();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo actualizar el estado.");
    console.error("[APPOINTMENTS] Status update failed:", error);
  }
};

const handleNoShow = async (appointment: AppointmentListItem) => {
  if (!confirm(`Marcar a ${appointment.customerName} como no asistio?`)) return;
  mutationError.value = null;
  try {
    await updateAppointmentStatus(appointment.id, { status: "no_show" });
    await loadDayAppointments();
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo actualizar el estado.");
    console.error("[APPOINTMENTS] No-show failed:", error);
  }
};

const cancelLabel = computed(() => {
  if (!editingAppointment.value) return "la cita seleccionada";
  return `${editingAppointment.value.customerName} - ${editingAppointment.value.serviceName}`;
});

const canMutateStatuses = computed(() => scopeRole.value === "manager" || scopeRole.value === "admin");

const router = useRouter();

const handleCheckout = (appointment: AppointmentListItem) => {
  router.push({
    path: "/pos/sell",
    query: { appointmentId: appointment.id },
  });
};

const handleViewReceipt = async (appointment: AppointmentListItem) => {
  if (!appointment.transactionId) {
    mutationError.value = "Esta cita no tiene una transaccion asociada.";
    return;
  }
  receiptLoading.value = true;
  mutationError.value = null;
  try {
    receiptData.value = await loadReceipt(appointment.transactionId);
    receiptOpen.value = true;
  } catch (error) {
    mutationError.value = resolveErrorMessage(error, "No se pudo cargar el recibo.");
    console.error("[APPOINTMENTS] Receipt load failed:", error);
  } finally {
    receiptLoading.value = false;
  }
};

watch(dashboardDate, () => {
  loadDashboardData();
}, { immediate: true });

watch(listDate, () => {
  loadDayAppointments();
}, { immediate: true });

watch(activeTab, (tab) => {
  if (tab === "citas") {
    loadCatalogForList();
  }
});

watch(createOpen, (open) => {
  if (!open) {
    editingAppointment.value = null;
  }
});

watch(editOpen, (open) => {
  if (!open) {
    editingAppointment.value = null;
  }
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <AppointmentTabs v-model="activeTab" />

    <UAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="mutationError"
    />

    <AppointmentSummaryPanel
      v-if="activeTab === 'resumen'"
      :dashboard="dashboardData"
      :loading="dashboardLoading"
      @navigate="activeTab = $event"
    />

    <template v-else>
      <AppointmentToolbar
        :selected-date="listDate"
        :appointments-count="appointments.length"
        @update:selected-date="listDate = $event"
        @create="openCreateModal"
      />

      <template v-if="listLoading">
        <div class="space-y-3">
          <USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-xl" />
        </div>
      </template>

      <template v-else-if="appointments.length > 0">
        <AppointmentKanbanBoard
          :appointments="appointments"
          :loading="listLoading"
          :can-mutate-statuses="canMutateStatuses"
          :mutation-loading="mutationLoading"
          @edit="openEditModal"
          @cancel="editingAppointment = $event; cancelOpen = true"
          @toggle-status="handleToggleStatus"
          @no-show="handleNoShow"
          @checkout="handleCheckout"
          @view-receipt="handleViewReceipt"
        />
      </template>

      <template v-else>
        <UiEmptyModuleState
          title="Sin citas para este dia"
          description="No hay citas agendadas. Crea una nueva para comenzar."
          icon="i-lucide-calendar-search"
          action-label="Nueva cita"
          @action="openCreateModal"
        />
      </template>
    </template>

    <UModal
      :open="createOpen"
      title="Crear cita"
      description="Selecciona servicio, colaborador y horario validando disponibilidad en tiempo real."
      @update:open="createOpen = $event"
    >
      <template #body>
        <AppointmentForm
          mode="create"
          :loading="mutationLoading"
          :allow-walk-in="true"
          :initial-value="formPreset"
          :branches="catalog.branches"
          :services="catalog.services"
          :employees="catalog.employees"
          :customers="catalog.customers"
          @cancel="closeFormModals"
          @submit="handleCreateSubmit"
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
        <AppointmentForm
          mode="edit"
          :loading="mutationLoading"
          :allow-walk-in="false"
          :initial-value="formPreset"
          :branches="catalog.branches"
          :services="catalog.services"
          :employees="catalog.employees"
          :customers="catalog.customers"
          submit-label="Guardar cita"
          @cancel="closeFormModals"
          @submit="handleUpdateSubmit"
        />
      </template>
    </UModal>

    <AppointmentCancelModal
      :open="cancelOpen"
      :loading="mutationLoading"
      :appointment-label="cancelLabel"
      @update:open="cancelOpen = $event"
      @submit="handleCancelSubmit"
    />

    <UModal v-if="receiptData" v-model:open="receiptOpen" title="Recibo de venta" size="xl">
      <template #body>
        <ReceiptViewer :receipt="receiptData" @close="receiptOpen = false; receiptData = null;" />
      </template>
    </UModal>
  </div>
</template>
