<script setup lang="ts">
import type { PaymentValidationDetail } from "@/composables/usePaymentSystem";

const props = defineProps<{
  open: boolean;
  validation: PaymentValidationDetail | null;
  loading?: boolean;
  actionLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  approve: [];
  reject: [];
}>();

const formatDate = (value: string | null) => {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatFileSize = (value: number | null) => {
  if (!value || value <= 0) {
    return "Tamano no disponible";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const isImage = computed(() =>
  props.validation?.receiptMimeType?.startsWith("image/") ?? false,
);
</script>

<template>
  <UModal
    :open="open"
    title="Detalle de validacion"
    description="Revisa la informacion de la organizacion y el comprobante antes de aprobar o rechazar."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-16 rounded-xl" />
        <USkeleton class="h-32 rounded-xl" />
        <USkeleton class="h-72 rounded-xl" />
      </div>

      <div v-else-if="validation" class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p class="text-sm text-slate-500 dark:text-slate-400">Organizacion</p>
            <p class="font-semibold text-slate-950 dark:text-white">{{ validation.organizationName }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ validation.organizationSlug }}</p>
          </div>

          <div>
            <p class="text-sm text-slate-500 dark:text-slate-400">Usuario</p>
            <p class="font-semibold text-slate-950 dark:text-white">{{ validation.userFullName }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ validation.userEmail }}</p>
          </div>
        </div>

        <UCard class="rounded-[1.25rem] bg-slate-50 dark:bg-slate-900/80">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="text-sm text-slate-500 dark:text-slate-400">Monto</p>
              <p class="font-mono text-lg font-bold text-slate-950 dark:text-white">${{ validation.amount.toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500 dark:text-slate-400">Metodo</p>
              <p class="font-medium text-slate-950 dark:text-white">{{ validation.paymentMethod ?? "bank_transfer" }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500 dark:text-slate-400">Referencia</p>
              <p class="font-mono text-slate-950 dark:text-white">{{ validation.transactionRef ?? "N/A" }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500 dark:text-slate-400">Enviado</p>
              <p class="font-medium text-slate-950 dark:text-white">{{ formatDate(validation.createdAt) }}</p>
            </div>
          </div>
        </UCard>

        <div class="space-y-2">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Comprobante</p>
          <div class="overflow-hidden rounded-[1.25rem] border border-slate-200 dark:border-slate-800">
            <img
              v-if="validation.receiptUrl && isImage"
              :src="validation.receiptUrl"
              alt="Comprobante"
              class="max-h-[26rem] w-full bg-slate-100 object-contain dark:bg-slate-950"
            >

            <div
              v-else-if="validation.receiptUrl && validation.receiptMimeType === 'application/pdf'"
              class="flex h-[24rem] flex-col items-center justify-center gap-3 bg-slate-100 text-center dark:bg-slate-950"
            >
              <UIcon name="i-lucide-file-text" class="h-16 w-16 text-slate-400" />
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Abre el PDF en una nueva pestana para revisarlo con mas detalle.
              </p>
              <UButton :to="validation.receiptUrl" target="_blank" color="primary" variant="soft">
                Abrir PDF
              </UButton>
            </div>

            <div
              v-else
              class="flex h-[24rem] items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400"
            >
              No hay comprobante disponible.
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>{{ validation.receiptFilename }} • {{ formatFileSize(validation.receiptSizeBytes) }}</span>
            <UButton
              v-if="validation.receiptUrl"
              :to="validation.receiptUrl"
              target="_blank"
              color="neutral"
              variant="soft"
              size="sm"
            >
              Descargar
            </UButton>
          </div>
        </div>

        <div v-if="validation.status !== 'pending'" class="grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2">
          <div>
            <p class="text-sm text-slate-500 dark:text-slate-400">Revisado por</p>
            <p class="font-medium text-slate-950 dark:text-white">{{ validation.reviewedByName ?? "System" }}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500 dark:text-slate-400">Fecha de revision</p>
            <p class="font-medium text-slate-950 dark:text-white">{{ formatDate(validation.reviewedAt) }}</p>
          </div>
          <div v-if="validation.status === 'rejected'" class="sm:col-span-2">
            <p class="text-sm text-slate-500 dark:text-slate-400">Motivo</p>
            <p class="font-medium text-error-600 dark:text-error-400">{{ validation.rejectionReason }}</p>
          </div>
        </div>
      </div>
    </template>

    <template v-if="validation?.status === 'pending'" #footer>
      <div class="flex gap-3">
        <UButton
          color="success"
          block
          :loading="actionLoading"
          @click="emit('approve')"
        >
          Aprobar pago
        </UButton>
        <UButton
          color="error"
          variant="outline"
          block
          :disabled="actionLoading"
          @click="emit('reject')"
        >
          Rechazar pago
        </UButton>
      </div>
    </template>
  </UModal>
</template>
