<script setup lang="ts">
import type { POSReceipt } from "@/composables/usePOS";

const props = defineProps<{
  receipt: POSReceipt | null;
}>();

const paymentLabels: Record<POSReceipt["paymentMethod"], string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  mixed: "Mixto",
  digital_wallet: "Billetera digital",
};

const printReceipt = () => {
  if (!import.meta.client) {
    return;
  }

  window.print();
};
</script>

<template>
  <div v-if="receipt" class="space-y-4">
    <div class="flex justify-end">
      <UButton color="primary" icon="i-lucide-printer" @click="printReceipt">
        Imprimir
      </UButton>
    </div>

    <div class="print:shadow-none rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <div class="border-b border-dashed border-slate-200 pb-4 dark:border-slate-700">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
          NexusPOS
        </p>
        <h2 class="mt-2 text-2xl font-semibold">
          Recibo #{{ receipt.invoiceNumber }}
        </h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ receipt.branchName }} · {{ new Date(receipt.createdAt).toLocaleString("es-BO") }}
        </p>
      </div>

      <div class="grid gap-4 border-b border-dashed border-slate-200 py-4 text-sm dark:border-slate-700 md:grid-cols-2">
        <div>
          <p class="font-semibold">Cliente</p>
          <p>{{ receipt.customer.fullName }}</p>
          <p class="text-slate-500 dark:text-slate-400">{{ receipt.customer.phone ?? "Sin teléfono" }}</p>
        </div>

        <div>
          <p class="font-semibold">Atendido por</p>
          <p>{{ receipt.employeeName }}</p>
          <p class="text-slate-500 dark:text-slate-400">{{ paymentLabels[receipt.paymentMethod] }}</p>
        </div>
      </div>

      <div class="space-y-3 py-4">
        <div
          v-for="item in receipt.items"
          :key="item.id"
          class="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 text-sm dark:border-slate-800"
        >
          <div>
            <p class="font-medium">{{ item.title }}</p>
            <p v-if="item.subtitle" class="text-slate-500 dark:text-slate-400">
              {{ item.subtitle }}
            </p>
            <p class="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {{ item.itemType === "product" ? "Producto" : "Servicio" }} · Cantidad {{ item.quantity }}
            </p>
          </div>

          <div class="text-right">
            <p>Bs {{ item.subtotal.toFixed(2) }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Bs {{ item.unitPrice.toFixed(2) }} c/u</p>
          </div>
        </div>
      </div>

      <div class="space-y-2 pt-4 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500 dark:text-slate-400">Subtotal</span>
          <span>Bs {{ receipt.totalAmount.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500 dark:text-slate-400">Descuento</span>
          <span>Bs {{ receipt.discountAmount.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500 dark:text-slate-400">Impuestos</span>
          <span>Bs {{ receipt.taxAmount.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>Bs {{ receipt.finalAmount.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
