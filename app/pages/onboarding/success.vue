<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import TimelineStep from "../../components/onboarding/TimelineStep.vue";

definePageMeta({
  layout: false,
  title: "Registro completado",
});

const redirectSeconds = ref(5);

let redirectTimer: ReturnType<typeof setInterval> | null = null;

const timelineSteps = [
  {
    title: "Cuenta creada",
    description: "Email verificado correctamente.",
    state: "completed" as const,
    icon: "i-lucide-check",
  },
  {
    title: "Negocio configurado",
    description: "Datos de tu empresa guardados.",
    state: "completed" as const,
    icon: "i-lucide-check",
  },
  {
    title: "Comprobante enviado",
    description: "Tu pago esta en revision.",
    state: "completed" as const,
    icon: "i-lucide-check",
  },
  {
    title: "Cuenta activa",
    description: "Acceso completo a todas las funciones.",
    state: "active" as const,
    icon: "i-lucide-loader-circle",
  },
];

if (import.meta.client) {
  onMounted(() => {
    redirectTimer = setInterval(() => {
      redirectSeconds.value -= 1;
      if (redirectSeconds.value <= 0) {
        clearInterval(redirectTimer as ReturnType<typeof setTimeout>);
        redirectTimer = null;
        navigateTo("/dashboard", { replace: true });
      }
    }, 1000);
  });

  onBeforeUnmount(() => {
    if (redirectTimer) {
      clearInterval(redirectTimer);
    }
  });
}
</script>

<template>
  <AuthLayout
    eyebrow="Éxito"
    title="¡Cuenta activada!"
    description="Tu cuenta está lista para usar."
    :show-sidebar="false"
  >
    <div class="space-y-6">
      <UCard class="admin-shell-panel overflow-hidden rounded-[2rem]">
        <div class="space-y-6 p-2 text-center">
          <div
            class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <UIcon name="i-lucide-badge-check" class="h-11 w-11" />
          </div>

          <div class="space-y-3">
            <h1 class="text-3xl font-semibold text-slate-950 dark:text-white md:text-4xl">
              Registro completado
            </h1>
            <p class="mx-auto max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
              Tu comprobante fue recibido. Redirigiendo al dashboard en
              <span class="font-bold text-primary-600 dark:text-primary-400">{{ redirectSeconds }}</span> segundos.
            </p>
          </div>

          <div class="mx-auto max-w-xl space-y-2">
            <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Progreso del onboarding</span>
              <span>3/3 completado</span>
            </div>
            <UProgress :model-value="100" color="primary" />
          </div>
        </div>
      </UCard>

      <UCard class="admin-shell-panel rounded-[1.75rem]">
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Tu proceso de registro</h2>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Todos los pasos completados exitosamente.
              </p>
            </div>

            <UBadge color="primary" variant="soft" class="rounded-full px-3 py-1">
              En revision
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <TimelineStep v-for="step in timelineSteps" :key="step.title" :title="step.title"
            :description="step.description" :state="step.state" :icon="step.icon" />
        </div>
      </UCard>

      <UCard
        class="rounded-[1.75rem] border-2 border-amber-400/80 bg-white/95 dark:border-amber-500/70 dark:bg-slate-950/60">
        <template #header>
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <UIcon name="i-lucide-info" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Estado: Pendiente de activacion</h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                Tu cuenta esta parcialmente activa mientras validamos el pago.
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm leading-7 text-slate-700 dark:text-slate-300">
            Puedes explorar NexusPOS y configurar tu catalogo, pero las operaciones reales (ventas, citas) seguiran
            bloqueadas
            hasta activacion.
          </p>

          <div
            class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <p><span class="font-semibold text-slate-950 dark:text-white">Plan:</span> Definido en configuracion de empresa
            </p>
          </div>
        </div>
      </UCard>

      <div class="grid gap-4 sm:grid-cols-2">
        <UButton color="primary" size="lg" block icon="i-lucide-layout-dashboard" class="justify-center"
          @click="navigateTo('/dashboard', { replace: true })">
          Ir al Dashboard ahora
        </UButton>

        <UButton variant="outline" color="neutral" size="lg" block icon="i-lucide-mail" class="justify-center">
          Contactar soporte
        </UButton>
      </div>
    </div>
  </AuthLayout>
</template>
