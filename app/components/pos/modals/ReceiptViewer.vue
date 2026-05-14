<script setup lang="ts">
import type { POSReceipt } from "@/composables/usePOS";

const props = defineProps<{
  receipt: POSReceipt;
}>();

const emit = defineEmits<{
  close: [];
}>();

const printReceipt = () => {
  const r = props.receipt;
  const rows: string[] = [];
  for (const item of r.items) {
    rows.push(`<tr><td style="padding:4px 0; border-bottom:1px solid #e2e8f0;">${item.title}<br><small style="color:#64748b;">${item.subtitle ?? ""}</small></td><td style="padding:4px 0; text-align:right; border-bottom:1px solid #e2e8f0;">${item.quantity} x Bs ${item.unitPrice.toFixed(2)}</td><td style="padding:4px 0; text-align:right; border-bottom:1px solid #e2e8f0; font-weight:600;">Bs ${item.subtotal.toFixed(2)}</td></tr>`);
  }
  const itemsHtml = rows.join("");
  const discountRow = r.discountAmount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Descuento</span><span>Bs ${r.discountAmount.toFixed(2)}</span></div>`
    : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo #${r.invoiceNumber}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;max-width:320px;margin:0 auto;padding:16px;color:#0f172a}.header{text-align:center;border-bottom:2px dashed #0f172a;padding-bottom:12px;margin-bottom:12px}.header h1{font-size:18px}.header p{font-size:12px;color:#475569}.info{font-size:12px;margin-bottom:12px}.info div{display:flex;justify-content:space-between;padding:2px 0}table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px}.total{border-top:2px dashed #0f172a;padding-top:8px;text-align:right;font-size:18px;font-weight:bold}.footer{text-align:center;margin-top:16px;font-size:11px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px}@media print{body{max-width:80mm}}</style></head><body><div class="header"><h1>NexusPOS</h1><p>${r.branchName}</p><p>Recibo de Venta</p></div><div class="info"><div><span>Factura #:</span><span>${r.invoiceNumber}</span></div><div><span>Fecha:</span><span>${new Date(r.createdAt).toLocaleString("es-BO")}</span></div><div><span>Cliente:</span><span>${r.customer.fullName}</span></div><div><span>Pago:</span><span>${r.paymentMethod}</span></div></div><table>${itemsHtml}</table>${discountRow}<div class="total">Bs ${r.finalAmount.toFixed(2)}</div><div class="footer"><p>Gracias por su compra</p><p>NexusPOS - Sistema de Punto de Venta</p></div><script>window.onload=()=>{window.print()}<\/script></body></html>`;

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
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

    <div class="flex justify-end gap-2">
      <UButton color="neutral" variant="soft" icon="i-lucide-printer" @click="printReceipt">
        Imprimir
      </UButton>
      <UButton color="neutral" variant="soft" @click="emit('close')">
        Cerrar
      </UButton>
    </div>
  </div>
</template>
