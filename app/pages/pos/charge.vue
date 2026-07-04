<script setup lang="ts">
import ReceiptViewer from "@/components/pos/modals/ReceiptViewer.vue";
import { usePOSCharge } from "@/composables/usePOSCharge";
import type { POSReceipt } from "@/composables/usePOS";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.sales.view",
  moduleKey: "pos.sales",
  roles: ["admin", "manager", "employee"],
});

const route = useRoute();
const { listReadyOrders, charge } = usePOSCharge();

const loading = ref(false);
const readyOrders = ref<Array<Record<string, unknown>>>([]);
const selectedSalesOrderId = ref<string>("");
const paymentMethod = ref<"cash" | "card" | "transfer" | "mixed" | "digital_wallet">("cash");
const salesReceipt = ref<POSReceipt | null>(null);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const loadReadyOrders = async () => {
  loading.value = true;
  error.value = null;

  try {
    const result = await listReadyOrders();
    readyOrders.value = result.orders;

    const requestedSalesOrderId = typeof route.query.salesOrderId === "string" ? route.query.salesOrderId : null;
    const requestedSalesOrder = requestedSalesOrderId
      ? result.orders.find((order) => String(order.id) === requestedSalesOrderId)
      : null;

    if (requestedSalesOrder) {
      selectedSalesOrderId.value = String(requestedSalesOrder.id);
    } else if (!selectedSalesOrderId.value && result.orders.length > 0) {
      selectedSalesOrderId.value = String(result.orders[0]?.id ?? "");
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudieron cargar las OV listas para cobro.";
  } finally {
    loading.value = false;
  }
};

const submitCharge = async () => {
  if (!selectedSalesOrderId.value) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const result = await charge({
      salesOrderId: selectedSalesOrderId.value,
      paymentMethod: paymentMethod.value,
    });
    salesReceipt.value = result.receipt;
    success.value = `Cobro completado. Transaccion ${result.transactionId.slice(0, 8)}.`;
    await loadReadyOrders();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "No se pudo cobrar la orden.";
  } finally {
    loading.value = false;
  }
};

onMounted(loadReadyOrders);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Cobrar</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Cobra ordenes listas y emite el recibo final.
        </p>
      </div>
      <UButton to="/pos/sell" color="neutral" variant="soft" icon="i-lucide-shopping-cart">
        Volver a Vender
      </UButton>
    </div>

    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <UAlert v-if="success" color="success" variant="soft" :title="success" />

    <UCard class="rounded-[1.75rem]">
      <div v-if="readyOrders.length === 0 && !loading" class="space-y-3">
        <UiEmptySearchState
          title="Sin ventas listas para cobro"
          description="Crea o marca una OV como lista para cobro desde Ventas para continuar."
          icon="i-lucide-wallet-cards"
        />
        <div class="flex justify-end">
          <UButton to="/pos/sell" color="primary" variant="soft">
            Ir a Vender
          </UButton>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <USelect
          v-model="selectedSalesOrderId"
          :items="readyOrders.map((order) => ({ label: `OV #${order.sales_order_number} · ${order.customer_full_name}`, value: String(order.id) }))"
          placeholder="Selecciona una OV"
        />
        <USelect
          v-model="paymentMethod"
          :items="[
            { label: 'Efectivo', value: 'cash' },
            { label: 'Tarjeta', value: 'card' },
            { label: 'Transferencia', value: 'transfer' },
            { label: 'Mixto', value: 'mixed' },
            { label: 'Billetera digital', value: 'digital_wallet' },
          ]"
        />
        <div class="flex gap-2">
          <UButton color="neutral" variant="soft" :loading="loading" @click="loadReadyOrders">
            Actualizar
          </UButton>
          <UButton color="primary" :loading="loading" :disabled="!selectedSalesOrderId" @click="submitCharge">
            Cobrar OV
          </UButton>
        </div>
      </div>
    </UCard>

    <UModal v-if="salesReceipt" :open="true" title="Recibo de venta" size="xl" @update:open="(open) => { if (!open) salesReceipt = null; }">
      <template #body>
        <ReceiptViewer :receipt="salesReceipt" @close="salesReceipt = null" />
      </template>
    </UModal>
  </div>
</template>
