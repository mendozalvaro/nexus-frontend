<script setup lang="ts">
import { computed } from "vue";
import type { PaymentPageState, ReceiptPreview } from "@/types/payment";

const props = defineProps<{
  loading?: boolean;
  uploadProgress?: number;
  error?: string | null;
  preview: ReceiptPreview | null;
  transactionRef: string;
  confirmTransfer: boolean;
  pageState: PaymentPageState;
  paymentMethod: string;
}>();

const paymentMethodOptions = [
  { label: "Transferencia bancaria", value: "bank_transfer" },
  { label: "Pago QR", value: "qr_payment" },
  { label: "Tarjeta de crédito/débito", value: "card" },
  { label: "PayPal", value: "paypal" },
  { label: "Otro", value: "other" },
];

const paymentMethod = computed({
  get: () => props.paymentMethod || "bank_transfer",
  set: (value) => emit("update:paymentMethod", value),
});

const canSubmit = computed(
  () => !!props.preview && props.confirmTransfer && props.pageState !== "pending",
);

const emit = defineEmits<{
  "update:transactionRef": [value: string];
  "update:confirmTransfer": [value: boolean];
  "update:paymentMethod": [value: string];
  "file-selected": [file: File];
  "clear-file": [];
  submit: [];
}>();

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  emit("file-selected", file);
};
</script>

<template>
  <UCard class="admin-shell-panel rounded-[1.75rem]">
    <template #header>
      <div>
        <h2 class="text-xl font-semibold text-slate-950 dark:text-white">Sube tu comprobante</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Aceptamos PDF, JPG o PNG de hasta 5MB.
        </p>
      </div>
    </template>

    <div class="space-y-5">
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="error"
      />

      <UFormField label="Método de pago" name="paymentMethod">
        <USelectMenu v-model="paymentMethod" :items="paymentMethodOptions" value-key="value" label-key="label"
          :disabled="pageState === 'pending' || loading" />
      </UFormField>

      <label
        class="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300/80 bg-slate-50/70 px-4 py-8 text-center transition hover:border-primary-400 hover:bg-primary-50/70 dark:border-slate-700 dark:bg-slate-900/65 dark:hover:border-primary-500 dark:hover:bg-primary-950/20 sm:px-6"
        :class="{ 'pointer-events-none opacity-70': pageState === 'pending' || loading }"
      >
        <UIcon name="i-lucide-upload-cloud" class="h-10 w-10 text-primary-500" />
        <span class="mt-3 text-sm font-semibold text-slate-950 dark:text-white">Seleccionar archivo</span>
        <span class="mt-1 text-xs text-slate-600 dark:text-slate-300">PDF, JPG o PNG de hasta 5MB</span>
        <input
          class="sr-only"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          :disabled="pageState === 'pending' || loading"
          @change="onFileChange"
        />
      </label>

      <div v-if="preview" class="rounded-[1.5rem] border border-slate-200/80 p-4 dark:border-slate-800">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="truncate font-semibold text-slate-950 dark:text-white">{{ preview.name }}</p>
            <p class="text-xs text-slate-600 dark:text-slate-300">{{ Math.ceil(preview.size / 1024) }} KB</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="soft">{{ preview.isPdf ? "PDF" : "Imagen" }}</UBadge>
            <UButton
              v-if="pageState !== 'pending' && !loading"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="min-h-11"
              @click="emit('clear-file')"
            >
              Quitar
            </UButton>
          </div>
        </div>

        <img v-if="preview.objectUrl" :src="preview.objectUrl" alt="Vista previa del comprobante" class="mt-4 max-h-80 w-full rounded-[1.25rem] object-contain" />
        <div v-else class="mt-4 rounded-[1.25rem] border border-dashed border-slate-300/80 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Vista previa PDF disponible al abrir el detalle. Archivo listo para envio.
        </div>
      </div>

      <div v-if="loading" class="space-y-2">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span>Subiendo comprobante</span>
          <span>{{ uploadProgress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div class="h-full rounded-full bg-primary-500 transition-all duration-300" :style="{ width: `${uploadProgress}%` }" />
        </div>
      </div>

      <UFormField label="Numero de transaccion o referencia" name="transactionRef" description="Opcional, pero ayuda a validar mas rapido.">
        <UInput
          :model-value="transactionRef"
          size="lg"
          placeholder="Ej. TX-984311"
          :disabled="pageState === 'pending' || loading"
          :ui="{ base: 'min-h-11 text-base' }"
          @update:model-value="emit('update:transactionRef', $event)"
        />
      </UFormField>

      <UCheckbox
        :model-value="confirmTransfer"
        label="Confirmo que he realizado la transferencia con los datos correctos"
        :disabled="pageState === 'pending' || loading"
        @update:model-value="emit('update:confirmTransfer', Boolean($event))"
      />

      <p v-if="pageState === 'pending'" class="text-sm text-sky-700 dark:text-sky-300">
        Tu comprobante ya esta en revision. Si soporte solicita un nuevo archivo, esta seccion se habilitara nuevamente.
      </p>

      <p v-else-if="!props.preview || !props.confirmTransfer" class="text-sm text-amber-600 dark:text-amber-400">
        {{ !props.preview ? 'Selecciona un comprobante antes de enviar.' : 'Debes confirmar la transferencia para continuar.' }}
      </p>

      <UButton :loading="loading" :disabled="!canSubmit || loading" block size="lg" class="auth-submit-button min-h-11" @click="emit('submit')">
        {{ loading ? "Enviando comprobante..." : "Enviar comprobante" }}
      </UButton>
    </div>
  </UCard>
</template>
