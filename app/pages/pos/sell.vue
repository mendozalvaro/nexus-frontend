<script setup lang="ts">
import POSBranchContextBar from "@/components/pos/POSBranchContextBar.vue";
import POSProformasList from "@/components/pos/POSProformasList.vue";
import POSSalesList from "@/components/pos/POSSalesList.vue";
import POSCart from "@/components/pos/POSCart.vue";
import ProductSearch from "@/components/pos/ProductSearch.vue";
import CustomerFormModal from "@/components/customers/modals/CustomerFormModal.vue";
import type { POSCustomerOption } from "@/composables/usePOS";
import type { POSProforma, POSSalesOrder, POSSalesOrderCustomerInput } from "@/composables/usePOSSales";
import type { CustomerMutationPayload } from "@/composables/useCustomers";
import { printProforma } from "@/utils/proforma-renderer";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.sales.view",
  moduleKey: "pos.sales",
  roles: ["admin", "manager", "employee"],
});

interface SaleDraft {
  customerMode: "existing" | "walk_in";
  customerId: string;
  fullName: string;
  phone: string;
  note: string;
}

const {
  cart,
  lastCatalog,
  loadCatalog,
  addProductToCart,
  addServiceToCart,
  removeCartItem,
  clearCart,
  updateProductQuantity,
  getCartSubtotal,
  searchCustomers,
  createPOSCustomer,
  replaceCartFromSalesOrderItems,
  loadAppointmentForPOS,
} = usePOS();
const { siatBillingEnabled, loadSiatBilling } = useSiatBilling();

const {
  listOrders,
  createOrder,
  updateOrder,
  issueProforma,
  listProformas,
  getOrder,
  resumeFromProforma,
} = usePOSSales();

const { profile } = useAuth();
const route = useRoute();
const { selectedBranchId, branches: scopedBranches, canSwitch, setSelectedBranch, restoreSelectedBranch } = useModuleBranchContext("pos");

const loading = ref(false);
const salesOrders = ref<POSSalesOrder[]>([]);
const proformaRecords = ref<POSProforma[]>([]);
const customerOptions = ref<POSCustomerOption[]>([]);
const editingSalesOrderId = ref<string | null>(null);
const saleDraft = ref<SaleDraft | null>(null);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const historyPanelOpen = ref(false);
const historyPanelTab = ref<"sales" | "proformas">("sales");
const customerModalOpen = ref(false);
const customerMutationLoading = ref(false);
const salesWorkspaceAnchor = ref<HTMLElement | null>(null);

const subtotal = computed(() => getCartSubtotal());
const canManageHistory = computed(() => ["admin", "manager", "employee"].includes(profile.value?.role ?? ""));
const canChargeSales = computed(() => profile.value?.role === "admin" || profile.value?.role === "manager");
const canOpenChargePage = computed(() => profile.value?.role === "admin" || profile.value?.role === "manager");
const anonymousCustomerLabel = "Cliente anónimo";

const availableBranches = computed(() => {
  const catalogBranches = lastCatalog.value?.branches ?? [];
  if (scopedBranches.value.length === 0) {
    return catalogBranches;
  }

  const allowedIds = new Set(scopedBranches.value.map((branch) => branch.id));
  return catalogBranches.filter((branch) => allowedIds.has(branch.id));
});

const branchStateMessage = computed(() => {
  if (selectedBranchId.value) {
    return null;
  }

  if (availableBranches.value.length > 0) {
    return "Selecciona una sucursal activa para empezar a vender.";
  }

  return "No tienes sucursales operativas disponibles para este modulo.";
});

const historyTabItems = computed<Array<{ label: string; value: "sales" | "proformas" }>>(() => [
  { label: "Ventas", value: "sales" },
  { label: "Proformas", value: "proformas" },
]);

const buildOrderItems = () => cart.value.map((item) => {
  if (item.itemType === "product") {
    return { itemType: "product" as const, productId: item.productId, quantity: item.quantity };
  }

  return {
    itemType: "service" as const,
    serviceId: item.serviceId,
    employeeId: item.employeeId,
    scheduledDate: item.scheduledDate,
    scheduledTime: item.scheduledTime,
    quantity: 1 as const,
  };
});

const resetOperationState = () => {
  editingSalesOrderId.value = null;
  saleDraft.value = null;
};

const buildSaleDraftFromOrder = (order: POSSalesOrder): SaleDraft => ({
  customerMode: order.customer_mode,
  customerId: order.customer_id ?? "",
  fullName: order.customer_full_name,
  phone: order.customer_phone ?? "",
  note: order.note ?? "",
});

const buildOrderCustomerInput = (): POSSalesOrderCustomerInput | null => {
  const draft = ensureSaleDraft();

  if (draft.customerMode === "existing") {
    return draft.customerId
      ? { mode: "existing", customerId: draft.customerId }
      : null;
  }

  if (draft.fullName.trim().length < 3 || draft.phone.trim().length < 7) {
    return null;
  }

  return {
    mode: "walk_in",
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim(),
  };
};

const ensureSaleDraft = () => {
  if (!saleDraft.value) {
    saleDraft.value = {
      customerMode: "walk_in",
      customerId: "",
      fullName: anonymousCustomerLabel,
      phone: "0000000",
      note: "",
    };
  }

  return saleDraft.value;
};

const handleCustomerModeChange = (mode: "existing" | "walk_in") => {
  const draft = ensureSaleDraft();
  draft.customerMode = mode;
  if (mode === "existing") {
    draft.customerId = "";
    return;
  }

  draft.customerId = "";
  draft.fullName = anonymousCustomerLabel;
  draft.phone = "0000000";
};

const handleExistingCustomerChange = (customerId: string) => {
  const draft = ensureSaleDraft();
  const option = customerOptions.value.find((entry) => entry.id === customerId);
  draft.customerMode = "existing";
  draft.customerId = customerId;
  draft.fullName = option?.fullName ?? draft.fullName;
  draft.phone = option?.phone ?? draft.phone;
};

const refreshHistory = async () => {
  const [ordersResult, proformasResult] = await Promise.all([listOrders(), listProformas()]);
  salesOrders.value = ordersResult.orders;
  proformaRecords.value = proformasResult.proformas;
};

const loadData = async () => {
  loading.value = true;
  error.value = null;

  try {
    await loadSiatBilling();
    await restoreSelectedBranch();
    const catalog = await loadCatalog();

    if (!selectedBranchId.value) {
      setSelectedBranch(catalog.currentBranchId ?? catalog.branches[0]?.id ?? null);
    }

    const appointmentId = typeof route.query.appointmentId === "string" ? route.query.appointmentId : null;
    if (appointmentId) {
      const context = await loadAppointmentForPOS(appointmentId);
      setSelectedBranch(context.branchId);
      saleDraft.value = {
        customerMode: context.customerId ? "existing" : "walk_in",
        customerId: context.customerId ?? "",
        fullName: context.isWalkIn ? anonymousCustomerLabel : "",
        phone: context.isWalkIn ? "0000000" : "",
        note: "",
      };
    }

    await refreshHistory();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar el workspace de venta.";
  } finally {
    loading.value = false;
  }
};

const focusSalesWorkspace = async () => {
  await nextTick();
  salesWorkspaceAnchor.value?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const handleCustomerSearch = async (query: string) => {
  if (query.trim().length < 2) {
    customerOptions.value = [];
    return;
  }

  try {
    customerOptions.value = await searchCustomers(query);
  } catch {
    customerOptions.value = [];
  }
};

const submitOrderDraft = async (
  action: "sale" | "proforma",
  payload: { note: string },
) => {
  if (cart.value.length === 0) {
    error.value = "Debes agregar al menos un item al carrito.";
    return;
  }

  const customer = buildOrderCustomerInput();
  if (!customer) {
    error.value = "Debes seleccionar un cliente valido para continuar.";
    return;
  }

  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    const wasEditing = Boolean(editingSalesOrderId.value);
    const activeBranchId = selectedBranchId.value ?? "";
    if (!activeBranchId) {
      error.value = "Debes seleccionar una sucursal activa.";
      return;
    }
    const orderInput = {
      branchId: activeBranchId,
      customer,
      discount: { type: "none" as const, value: 0 },
      note: payload.note,
      items: buildOrderItems(),
      status: action === "sale" ? "ready_to_charge" as const : "draft" as const,
    };

    const orderResult = editingSalesOrderId.value
      ? await updateOrder(editingSalesOrderId.value, orderInput)
      : await createOrder(orderInput);

    editingSalesOrderId.value = orderResult.order.id;
    saleDraft.value = buildSaleDraftFromOrder(orderResult.order);

    if (action === "sale") {
      success.value = wasEditing ? "Venta actualizada." : "Venta registrada.";
      historyPanelTab.value = "sales";
    } else {
      await issueProforma(orderResult.order.id);
      success.value = wasEditing ? "Proforma actualizada." : "Proforma registrada.";
      historyPanelTab.value = "proformas";
    }

    await refreshHistory();
    if (canManageHistory.value) {
      historyPanelOpen.value = true;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo registrar la operacion.";
  } finally {
    loading.value = false;
  }
};

const editSalesOrder = async (orderId: string) => {
  loading.value = true;
  error.value = null;

  try {
    const detail = await getOrder(orderId);
    saleDraft.value = buildSaleDraftFromOrder(detail.order);
    editingSalesOrderId.value = detail.order.id;
    replaceCartFromSalesOrderItems(detail.items);
    setSelectedBranch(detail.order.branch_id);
    historyPanelOpen.value = false;
    await focusSalesWorkspace();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar la orden.";
  } finally {
    loading.value = false;
  }
};

const resumeProforma = async (proformaId: string) => {
  const proforma = proformaRecords.value.find((item) => item.id === proformaId) ?? null;
  if (!proforma) {
    error.value = "No se encontro la proforma solicitada.";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const detail = await resumeFromProforma(proformaId);
    replaceCartFromSalesOrderItems(detail.items);
    editingSalesOrderId.value = detail.order.id;
    saleDraft.value = buildSaleDraftFromOrder(detail.order);
    setSelectedBranch(detail.order.branch_id);
    historyPanelOpen.value = false;
    await refreshHistory();
    await focusSalesWorkspace();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo retomar la proforma.";
  } finally {
    loading.value = false;
  }
};

const handlePrintProforma = async (proformaId: string) => {
  const proforma = proformaRecords.value.find((item) => item.id === proformaId) ?? null;
  if (!proforma) {
    error.value = "No se encontro la proforma para imprimir.";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const detail = await getOrder(proforma.sales_order_id);
    printProforma({
      proforma,
      order: detail.order,
      items: detail.items,
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo imprimir la proforma.";
  } finally {
    loading.value = false;
  }
};

const goToChargePage = async (orderId: string) => {
  await navigateTo(`/pos/charge?salesOrderId=${encodeURIComponent(orderId)}`);
};

const openHistoryPanel = (tab: "sales" | "proformas" = "sales") => {
  historyPanelTab.value = tab;
  historyPanelOpen.value = true;
};

const updateDraftNote = (note: string) => {
  ensureSaleDraft().note = note;
};

const openCreateCustomer = () => {
  customerModalOpen.value = true;
};

const handleCreateCustomer = async (payload: CustomerMutationPayload) => {
  customerMutationLoading.value = true;
  error.value = null;
  try {
    const created = await createPOSCustomer(payload);
    customerOptions.value = [
      {
        id: created.id,
        fullName: created.fullName,
        email: created.email ?? "",
        phone: created.phone ?? null,
      },
      ...customerOptions.value.filter((customer) => customer.id !== created.id),
    ];

    const draft = ensureSaleDraft();
    draft.customerMode = "existing";
    draft.customerId = created.id;
    draft.fullName = created.fullName;
    draft.phone = created.phone ?? "";

    customerModalOpen.value = false;
    success.value = "Cliente creado y seleccionado correctamente.";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo crear el cliente.";
  } finally {
    customerMutationLoading.value = false;
  }
};

const submitSaleFromCart = async () => {
  await submitOrderDraft("sale", { note: saleDraft.value?.note ?? "" });
};

const submitProformaFromCart = async () => {
  await submitOrderDraft("proforma", { note: saleDraft.value?.note ?? "" });
};

const clearSaleWorkspace = () => {
  clearCart();
  resetOperationState();
  success.value = null;
  error.value = null;
};

onMounted(loadData);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-950 dark:text-white">Vender</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Registra ventas y proformas desde una sola pantalla.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton v-if="canManageHistory" color="neutral" variant="soft" icon="i-lucide-history" @click="openHistoryPanel('sales')">
          Historial
        </UButton>
        <UButton v-if="canOpenChargePage" to="/pos/charge" color="primary" variant="soft" icon="i-lucide-credit-card">
          Ir a Cobrar
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <UAlert v-if="success" color="success" variant="soft" :title="success" />
    <UAlert v-if="branchStateMessage" color="warning" variant="soft" :title="branchStateMessage" />

    <POSBranchContextBar
      :branches="availableBranches"
      :selected-branch-id="selectedBranchId ?? ''"
      :can-switch="canSwitch"
      @update:selected-branch-id="setSelectedBranch"
    />

    <div class="space-y-6">
      <div ref="salesWorkspaceAnchor" class="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div class="xl:col-span-2">
          <POSCart
            :items="cart"
            :branches="availableBranches"
            :subtotal="subtotal"
            :loading="loading"
            :note="saleDraft?.note ?? ''"
            :editing="Boolean(editingSalesOrderId)"
            :customer-mode="saleDraft?.customerMode ?? 'walk_in'"
            :customer-id="saleDraft?.customerId ?? ''"
            :customer-name="saleDraft?.fullName ?? anonymousCustomerLabel"
            :customer-phone="saleDraft?.phone ?? '0000000'"
            :customer-options="customerOptions"
            :anonymous-label="anonymousCustomerLabel"
            @update-quantity="({ id, quantity }) => updateProductQuantity(id, quantity)"
            @remove="removeCartItem"
            @clear="clearSaleWorkspace"
            @search-customers="handleCustomerSearch"
            @update-customer-mode="handleCustomerModeChange"
            @update-customer-existing="handleExistingCustomerChange"
            @update-note="updateDraftNote"
            @submit-sale="submitSaleFromCart"
            @submit-proforma="submitProformaFromCart"
            @create-customer="openCreateCustomer"
          />
        </div>

        <div class="xl:col-span-3">
          <ProductSearch
            v-if="lastCatalog"
            :products="lastCatalog.products"
            :services="lastCatalog.services"
            :employees="lastCatalog.employees"
            :categories="lastCatalog.categories"
            :selected-branch-id="selectedBranchId ?? ''"
            :loading="loading"
            @add-product="({ product, quantity }) => addProductToCart(product, selectedBranchId ?? '', quantity)"
            @add-service="({ service, employee, scheduledDate, scheduledTime }) => addServiceToCart(service, selectedBranchId ?? '', employee, scheduledDate, scheduledTime)"
          />
        </div>
      </div>
    </div>

    <USlideover v-if="historyPanelOpen" :open="historyPanelOpen" side="right" @update:open="historyPanelOpen = $event">
      <template #header>
        <div class="w-full space-y-1">
          <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Historial de ventas</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Consulta ventas y proformas recientes desde un panel lateral.</p>
        </div>
      </template>

      <template #body>
        <div class="space-y-4 px-1 pb-4">
          <UTabs v-model="historyPanelTab" :items="historyTabItems">
            <template #content="{ item }">
              <POSSalesList
                v-if="item.value === 'sales'"
                :rows="salesOrders"
                :loading="loading"
                :can-pay="canChargeSales"
                :can-edit="true"
                @edit="editSalesOrder"
                @pay="goToChargePage"
              />

              <POSProformasList
                v-else
                :rows="proformaRecords"
                :loading="loading"
                @resume="resumeProforma"
                @print="handlePrintProforma"
              />
            </template>
          </UTabs>
        </div>
      </template>
    </USlideover>

    <CustomerFormModal
      :open="customerModalOpen"
      mode="create"
      :loading="customerMutationLoading"
      :show-billing-fields="siatBillingEnabled"
      @update:open="customerModalOpen = $event"
      @submit="handleCreateCustomer"
    />
  </div>
</template>

