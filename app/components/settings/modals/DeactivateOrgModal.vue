<script setup lang="ts">
interface Props {
  open: boolean;
  loading: boolean;
  orgName: string;
}

interface Emits {
  (e: "update:open", value: boolean): void;
  (e: "confirm"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const confirmed = ref(false);
const countdown = ref(5);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

const startCountdown = () => {
  countdown.value = 5;
  confirmed.value = false;
  countdownInterval = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      confirmed.value = true;
      if (countdownInterval) clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }, 1000);
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      startCountdown();
    } else {
      if (countdownInterval) clearInterval(countdownInterval);
      countdownInterval = null;
      confirmed.value = false;
      countdown.value = 5;
    }
  },
);

const handleConfirm = () => {
  if (!confirmed.value) return;
  emit("confirm");
};

const handleClose = () => {
  emit("update:open", false);
};
</script>

<template>
  <UModal
    :open="open"
    title="Desactivar organizacion"
    description="Esta accion es irreversible y afectara a todos los usuarios."
    :ui="{ content: 'max-w-lg' }"
    @update:open="handleClose"
  >
    <template #body>
      <div class="space-y-4">
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            Estas a punto de desactivar <span class="font-bold">{{ orgName }}</span>
          </p>
          <ul class="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">
            <li>• Se bloqueara el acceso para todos los usuarios</li>
            <li>• Se cancelaran citas pendientes</li>
            <li>• Se bloquearan operaciones de inventario y ventas</li>
            <li>• Se enviara un email de confirmacion al administrador</li>
          </ul>
        </div>

        <div class="flex items-center gap-3">
          <UCheckbox v-model="confirmed" :disabled="!confirmed && countdown > 0" />
          <label class="text-sm text-slate-700 dark:text-slate-300">
            <template v-if="countdown > 0">
              Espera {{ countdown }} segundos para confirmar...
            </template>
            <template v-else>
              Entiendo las consecuencias y deseo desactivar la organizacion
            </template>
          </label>
        </div>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="handleClose">
            Cancelar
          </UButton>
          <UButton
            color="error"
            :loading="loading"
            :disabled="!confirmed || loading"
            @click="handleConfirm"
          >
            Desactivar organizacion
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
