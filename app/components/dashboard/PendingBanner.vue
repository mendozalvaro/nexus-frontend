<script setup lang="ts">
import type { DashboardAccountStatus } from "@/composables/useDashboard";

const props = withDefaults(defineProps<{
  accountStatus?: DashboardAccountStatus;
  checkingStatus?: boolean;
}>(), {
  accountStatus: "pending",
  checkingStatus: false,
});

const supportOpen = ref(false);

const openSupportModal = () => {
  supportOpen.value = true;
};

const emit = defineEmits<{
  check: [];
}>();

const bannerConfig = computed(() => {
  if (props.accountStatus === "rejected") {
    return {
      icon: "i-heroicons-exclamation-triangle",
      color: "error" as const,
      title: "Tu comprobante requiere una nueva revision",
      description:
        "Detectamos que el ultimo comprobante no pudo validarse. Puedes revisar el estado y volver a cargar uno nuevo desde el onboarding.",
    };
  }

  if (props.accountStatus === "suspended") {
    return {
      icon: "i-heroicons-no-symbol",
      color: "error" as const,
      title: "Tu cuenta esta suspendida",
      description:
        "El acceso operativo esta bloqueado hasta regularizar el estado de la suscripcion. Contacta soporte para reactivarla.",
    };
  }

  return {
    icon: "i-heroicons-clock",
    color: "warning" as const,
    title: "Tu cuenta esta en validacion",
    description:
      "Estamos revisando tu comprobante de pago. Recibiras un email cuando tu cuenta este activa (estimado: <1 hora habil). Mientras tanto, puedes explorar y configurar tu organizacion.",
  };
});
</script>

<template>
  <div class="space-y-4">
    <UAlert
      :icon="bannerConfig.icon"
      :color="bannerConfig.color"
      variant="subtle"
      class="rounded-[1.5rem] border border-current/10 shadow-sm"
      >
      <template #title>
        {{ bannerConfig.title }}
      </template>
      <template #description>
        {{ bannerConfig.description }}
      </template>
      <template #actions>
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-heroicons-arrow-path"
          :loading="checkingStatus"
          @click="emit('check')"
        >
          Verificar ahora
        </UButton>

        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          @click="openSupportModal"
        >
          Necesito ayuda
        </UButton>
      </template>
    </UAlert>

    <UModal :open="supportOpen" title="Soporte NexusPOS" description="Placeholder para chat, email o help desk en Fase 2." @update:open="supportOpen = $event">
      <template #body>
        <div class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>Escribenos a <a class="font-semibold text-primary-700 dark:text-primary-300" href="mailto:soporte@nexuspos.app">soporte@nexuspos.app</a>.</p>
          <p>En Fase 2 este modal se integrara con ticketing, chat y seguimiento automatizado.</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
