<script setup lang="ts">
import type {
  POSCheckoutPayload,
  POSCustomerOption,
  POSEmployeeItem,
  POSReceipt,
  POSServiceItem,
} from "@/composables/usePOS";
import { usePOS } from "@/composables/usePOS";
import POSCart from "@/components/pos/POSCart.vue";
import ProductSearch from "@/components/pos/ProductSearch.vue";
import CheckoutForm from "@/components/pos/forms/CheckoutForm.vue";
import ReceiptViewer from "@/components/pos/modals/ReceiptViewer.vue";
import TransactionHistory from "@/components/pos/slideovers/TransactionHistory.vue";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.view",
  roles: ["admin", "manager", "employee"],
});

const {
  cart,
  lastCatalog,
  loadCatalog,
  searchCustomers,
  addProductToCart,
  addServiceToCart,
  updateProductQuantity,
  removeCartItem,
  clearCart,
  getCartSubtotal,
  getCheckoutPreview,
  checkout,
  loadTransactions,
  loadReceipt,
  loadAppointmentForPOS,
  appointmentContext,
} = usePOS();

const loading = ref(false);
const checkoutOpen = ref(false);
const receipt = ref<POSReceipt | null>(null);
const transactionsOpen = ref(false);
const transactions = ref<Awaited<ReturnType<typeof loadTransactions>>>([]);
const customerOptions = ref<POSCustomerOption[]>([]);
const appointmentCustomerId = ref<string | null>(null);
const appointmentWalkIn = ref<{ fullName: string; phone: string } | null>(null);
const selectedBranchId = ref<string>("");
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const subtotal = computed(() => getCartSubtotal());
const checkoutPreview = computed(() => getCheckoutPreview({ type: "none", value: 0 }));
const selectedBranch = computed(() => lastCatalog.value?.branches.find((b) => b.id === selectedBranchId.value) ?? null);
const catalogBranches = computed(() => lastCatalog.value?.branches ?? []);

const initCatalog = async () => {
  loading.value = true;
  error.value = null;
  try {
    const catalog = await loadCatalog();
    if (catalog.branches.length > 0) {
      selectedBranchId.value = catalog.currentBranchId ?? catalog.branches[0]!.id;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar el catalogo.";
  } finally {
    loading.value = false;
  }
};

const handleAddProduct = ({ product, quantity }: { product: Parameters<typeof addProductToCart>[0]; quantity: number }) => {
  try {
    addProductToCart(product, selectedBranchId.value, quantity);
    success.value = `${product.name} agregado al carrito.`;
    setTimeout(() => { success.value = null; }, 2000);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo agregar el producto.";
  }
};

const handleAddService = (args: { service: POSServiceItem; employee: POSEmployeeItem; scheduledDate: string; scheduledTime: string }) => {
  addServiceToCart(args.service, selectedBranchId.value, args.employee, args.scheduledDate, args.scheduledTime);
  success.value = `${args.service.name} agendado y agregado al carrito.`;
  setTimeout(() => { success.value = null; }, 2000);
};

const handleUpdateQuantity = ({ id, quantity }: { id: string; quantity: number }) => {
  try {
    updateProductQuantity(id, quantity);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo actualizar la cantidad.";
  }
};

const handleSearchCustomers = async (query: string) => {
  if (query.trim().length < 2) { customerOptions.value = []; return; }
  try { customerOptions.value = await searchCustomers(query); } catch { customerOptions.value = []; }
};

const handleSubmitCheckout = async (payload: POSCheckoutPayload) => {
  loading.value = true;
  error.value = null;
  try {
    const hasAppointmentContext = !!appointmentContext.value.appointmentId;
    const result = await checkout({
      ...payload,
      createAppointments: hasAppointmentContext ? false : payload.createAppointments,
      appointmentId: appointmentContext.value.appointmentId ?? payload.appointmentId ?? null,
    });
    receipt.value = result;
    checkoutOpen.value = false;
    success.value = `Venta #${result.invoiceNumber} completada exitosamente.`;
    appointmentContext.value = {
      appointmentId: null,
      customerName: null,
      serviceName: null,
      employeeName: null,
      dateTime: null,
    };
    appointmentCustomerId.value = null;
    appointmentWalkIn.value = null;
    customerOptions.value = [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo procesar la venta.";
  } finally {
    loading.value = false;
  }
};

const openTransactions = async () => {
  transactionsOpen.value = true;
  loading.value = true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    transactions.value = await loadTransactions(today, selectedBranchId.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar el historial.";
  } finally {
    loading.value = false;
  }
};

const viewReceipt = async (transactionId: string) => {
  try {
    receipt.value = await loadReceipt(transactionId);
    transactionsOpen.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar el recibo.";
  }
};

const receiptModalOpen = computed({
  get: () => receipt.value !== null,
  set: (v: boolean) => { if (!v) receipt.value = null; },
});

const route = useRoute();
const appointmentLoading = ref(false);

const loadAppointmentContext = async () => {
  const appointmentId = route.query.appointmentId as string | undefined;
  if (!appointmentId) return;

  appointmentLoading.value = true;
  error.value = null;
  try {
    const context = await loadAppointmentForPOS(appointmentId);
    if (context.customerId) {
      appointmentCustomerId.value = context.customerId;
      customerOptions.value = [{
        id: context.customerId,
        fullName: context.customerName,
        email: "",
        phone: context.customerPhone,
      }];
    } else if (context.isWalkIn) {
      appointmentWalkIn.value = {
        fullName: context.customerName,
        phone: context.customerPhone ?? "",
      };
    }
    success.value = `Cita cargada: ${appointmentContext.value.serviceName} con ${appointmentContext.value.employeeName}`;
    setTimeout(() => { success.value = null; }, 3000);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cargar la cita.";
  } finally {
    appointmentLoading.value = false;
  }
};

onMounted(async () => {
  await initCatalog();
  await loadAppointmentContext();
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-950 dark:text-white">Punto de Venta</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ selectedBranch?.name ?? "Selecciona una sucursal" }}</p>
      </div>
      <div class="flex gap-2">
        <UButton color="neutral" variant="soft" icon="i-lucide-clock" :disabled="loading" @click="openTransactions">
          Historial
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-x" :title="error" @click:close="error = null" />
    <UAlert v-if="success" color="success" variant="soft" icon="i-lucide-circle-check" :title="success" @click:close="success = null" />
    <UAlert
      v-if="appointmentContext.appointmentId"
      color="info"
      variant="soft"
      icon="i-lucide-calendar-check"
      :title="`Cita pre-cargada: ${appointmentContext.serviceName}`"
      :description="`${appointmentContext.employeeName} · ${appointmentContext.dateTime ? new Date(appointmentContext.dateTime).toLocaleString('es-BO') : ''}`"
      @click:close="appointmentContext.appointmentId = null; appointmentCustomerId = null; appointmentWalkIn = null; clearCart();"
    />

    <div v-if="(loading && !lastCatalog) || appointmentLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="lastCatalog">
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="xl:col-span-2">
          <ProductSearch
            :products="lastCatalog.products"
            :services="lastCatalog.services"
            :employees="lastCatalog.employees"
            :categories="lastCatalog.categories"
            :selected-branch-id="selectedBranchId"
            :loading="loading"
            @add-product="handleAddProduct"
            @add-service="handleAddService"
          />
        </div>
        <div>
          <POSCart
            :items="cart"
            :branches="lastCatalog.branches"
            :subtotal="subtotal"
            :loading="loading"
            @update-quantity="handleUpdateQuantity"
            @remove="removeCartItem"
            @clear="clearCart"
            @checkout="checkoutOpen = true"
          />
        </div>
      </div>
    </template>

    <UAlert
      v-else-if="!loading && (!lastCatalog || catalogBranches.length === 0)"
      color="warning"
      variant="soft"
      icon="i-lucide-store"
      title="Sin sucursales disponibles"
      description="No se encontraron sucursales activas. Contacta al administrador para configurar al menos una sucursal."
    />

    <UModal v-model:open="checkoutOpen" title="Cobrar venta" description="Completa los datos para procesar la venta." size="xl">
      <template #body>
        <CheckoutForm
          :loading="loading"
          :branches="catalogBranches"
          :selected-branch-id="selectedBranchId"
          :subtotal="subtotal"
          :discount-amount="checkoutPreview.discountAmount"
          :final-amount="checkoutPreview.finalAmount"
          :customer-options="customerOptions"
          :has-appointment-context="!!appointmentContext.appointmentId"
          :appointment-customer-id="appointmentCustomerId"
          :appointment-walk-in="appointmentWalkIn"
          @submit="handleSubmitCheckout"
          @cancel="checkoutOpen = false"
          @search-customers="handleSearchCustomers"
        />
      </template>
    </UModal>

    <USlideover v-model:open="transactionsOpen" title="Historial de ventas" side="right">
      <template #body>
        <TransactionHistory
          :transactions="transactions"
          :loading="loading"
          @view-receipt="viewReceipt"
        />
      </template>
    </USlideover>

    <UModal v-if="receipt" v-model:open="receiptModalOpen" title="Recibo de venta" size="xl">
      <template #body>
        <ReceiptViewer :receipt="receipt" @close="receipt = null" />
      </template>
    </UModal>
  </div>
</template>
