<script setup lang="ts">
const props = defineProps<{
  organizationSlug: string;
  amountUsd: number;
  planName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrPlaceholderUrl: string;
}>();

const referenceCode = computed(() => `NexusPOS-${props.organizationSlug}`);
const copiedValue = ref<"account" | "reference" | null>(null);
const copyError = ref<string | null>(null);

let copyFeedbackTimer: number | null = null;

const resetFeedback = () => {
  copiedValue.value = null;
  copyError.value = null;
};

const copyText = async (
  value: string,
  target: "account" | "reference",
) => {
  if (!import.meta.client) {
    return;
  }

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.className = "fixed -left-[9999px] top-0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    copiedValue.value = target;
    copyError.value = null;
  } catch {
    copiedValue.value = null;
    copyError.value = "No pudimos copiar el dato. Puedes copiarlo manualmente.";
  }

  copyFeedbackTimer = window.setTimeout(resetFeedback, 2200);
};

const copyReference = async () => {
  await copyText(referenceCode.value, "reference");
};

const copyAccountNumber = async () => {
  await copyText(props.accountNumber, "account");
};

onBeforeUnmount(() => {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
  }
});
</script>

<template>
  <UCard class="admin-shell-panel rounded-[1.75rem]">
    <template #header>
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700 dark:text-primary-300">
          Transferencia manual
        </p>
        <h2 class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
          Completa tu registro con una transferencia
        </h2>
      </div>
    </template>

    <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-4">
        <div class="rounded-[1.5rem] bg-primary-50 p-4 dark:bg-primary-950/30">
          <p class="text-sm text-slate-600 dark:text-slate-300">Monto mensual</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">${{ amountUsd }} USD/mes</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ planName }}</p>
        </div>

        <dl class="grid gap-3">
          <div class="rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-slate-800">
            <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Banco</dt>
            <dd class="mt-2 text-base font-semibold text-slate-950 dark:text-white">{{ bankName }}</dd>
          </div>
          <div class="rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-slate-800">
            <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Cuenta</dt>
            <div class="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <dd class="break-all text-base font-semibold text-slate-950 dark:text-white">{{ accountNumber }}</dd>
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-copy" class="min-h-11" @click="copyAccountNumber">
                {{ copiedValue === "account" ? "Copiado" : "Copiar" }}
              </UButton>
            </div>
          </div>
          <div class="rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-slate-800">
            <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Titular</dt>
            <dd class="mt-2 text-base font-semibold text-slate-950 dark:text-white">{{ accountHolder }}</dd>
          </div>
          <div class="rounded-[1.25rem] border border-slate-200/80 p-4 dark:border-slate-800">
            <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Referencia</dt>
                <dd class="mt-2 break-all text-base font-semibold text-slate-950 dark:text-white">{{ referenceCode }}</dd>
              </div>

              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-copy" class="min-h-11" @click="copyReference">
                {{ copiedValue === "reference" ? "Copiado" : "Copiar" }}
              </UButton>
            </div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Importante: usa esta referencia para identificar tu pago.
            </p>
          </div>
        </dl>

        <UAlert
          color="info"
          variant="soft"
          icon="i-lucide-info"
          title="Validacion manual en menos de 1 hora habil"
          description="Conserva esta referencia en tu comprobante para agilizar la revision."
        />

        <p
          v-if="copiedValue || copyError"
          class="text-sm"
          :class="copyError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'"
        >
          {{ copyError ?? "Dato copiado al portapapeles." }}
        </p>
      </div>

      <div class="rounded-[1.5rem] border border-dashed border-slate-300/80 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/65">
        <p class="text-sm font-semibold text-slate-950 dark:text-white">QR para billetera o banca movil</p>
        <img :src="qrPlaceholderUrl" alt="QR referencial para transferencia manual" class="mt-4 aspect-square w-full rounded-[1.25rem] object-cover" />
        <p class="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
          Placeholder para QR dinamico. En Fase 2 podemos generar un QR unico por organizacion o metodo de pago.
        </p>
      </div>
    </div>
  </UCard>
</template>
