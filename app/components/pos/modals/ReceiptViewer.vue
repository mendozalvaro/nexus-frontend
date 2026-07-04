<script setup lang="ts">
import type { POSReceipt, ReceiptFormat } from "@/composables/usePOS";
import { downloadReceiptPdf, printReceiptByFormat } from "@/utils/receipt-renderer";

const props = defineProps<{
  receipt: POSReceipt;
}>();

const emit = defineEmits<{
  close: [];
}>();
const toast = useToast();

const selectedFormat = ref<ReceiptFormat>(props.receipt.formatUsed ?? "thermal");
const downloadingPdf = ref(false);

watch(
  () => props.receipt.formatUsed,
  (value) => {
    selectedFormat.value = value ?? "thermal";
  },
  { immediate: true },
);

const printSelected = () => {
  printReceiptByFormat(props.receipt, selectedFormat.value);
};

const downloadPdf = async () => {
  downloadingPdf.value = true;
  try {
    await downloadReceiptPdf(props.receipt);
    toast.add({
      title: "PDF generado",
      description: "El recibo media carta se descargo correctamente.",
      color: "success",
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "No se pudo descargar el PDF en este momento.";
    toast.add({
      title: "Fallo al descargar PDF",
      description: message,
      color: "error",
    });
  } finally {
    downloadingPdf.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/70">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-slate-500 dark:text-slate-400">Factura #</span>
          <p class="font-semibold text-slate-950 dark:text-white">{{ receipt.invoiceNumber }}</p>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">Fecha</span>
          <p class="font-semibold text-slate-950 dark:text-white">{{ new Date(receipt.createdAt).toLocaleString("es-BO") }}</p>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">Sucursal</span>
          <p class="font-semibold text-slate-950 dark:text-white">{{ receipt.branchName }}</p>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">Cliente</span>
          <p class="font-semibold text-slate-950 dark:text-white">{{ receipt.customer.fullName }}</p>
        </div>
      </div>
      <div class="mt-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">Verificación segura</p>
        <a :href="receipt.verificationUrl" target="_blank" class="text-xs text-primary-600 underline break-all">
          {{ receipt.verificationUrl }}
        </a>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField label="Formato para imprimir/reimprimir">
        <USelect
          v-model="selectedFormat"
          :items="[
            { label: 'Térmico (ticket)', value: 'thermal' },
            { label: 'Media carta', value: 'half_letter' },
          ]"
          label-key="label"
          value-key="value"
        />
      </UFormField>
    </div>

    <div>
      <h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Items</h3>
      <div v-for="item in receipt.items" :key="item.id" class="flex items-center justify-between border-b border-slate-200 py-2 dark:border-slate-800">
        <div>
          <p class="font-medium text-slate-950 dark:text-white">{{ item.title }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.subtitle }}</p>
        </div>
        <div class="text-right">
          <p class="font-medium text-slate-950 dark:text-white">{{ item.quantity }} x Bs {{ item.unitPrice.toFixed(2) }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">Bs {{ item.subtotal.toFixed(2) }}</p>
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950">
      <div class="flex items-center justify-between text-lg font-semibold">
        <span>Total</span>
        <span>Bs {{ receipt.finalAmount.toFixed(2) }}</span>
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-2">
      <UButton color="neutral" variant="soft" icon="i-lucide-printer" @click="printSelected">
        Imprimir
      </UButton>
      <UButton color="primary" variant="soft" icon="i-lucide-file-text" :loading="downloadingPdf" @click="downloadPdf">
        Descargar PDF media carta
      </UButton>
      <UButton color="neutral" variant="soft" @click="emit('close')">
        Cerrar
      </UButton>
    </div>
  </div>
</template>
