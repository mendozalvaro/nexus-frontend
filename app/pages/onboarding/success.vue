<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import StatusCard from "../../components/onboarding/StatusCard.vue";
import TimelineStep from "../../components/onboarding/TimelineStep.vue";

definePageMeta({
  layout: false,
  title: "Registro casi completo",
});

const supportOpen = ref(false);
const {
  state,
  loading,
  error,
  checkingStatus,
  formattedLastCheckedAt,
  formattedSubmittedAt,
  formattedPeriodEnd,
  ensureSuccessAccess,
  loadSuccessState,
  refreshActivationStatus,
  startActivationPolling,
} = useOnboarding();

const availableItems = [
  "Ver y editar el perfil de tu organizacion",
  "Configurar servicios y productos del catalogo",
  "Agregar empleados sin roles operativos finales",
  "Explorar el dashboard con datos de ejemplo",
  "Consultar tutoriales y documentacion base",
];

const restrictedItems = [
  "Crear citas reales con clientes",
  "Procesar ventas y operaciones de POS",
  "Invitar clientes al portal",
  "Acceder a reportes avanzados de negocio",
];

const timelineSteps = computed(() => {
  const organizationName = state.value?.organization.name ?? "Tu organizacion";
  const submittedAt = formattedSubmittedAt.value;

  return [
    {
      title: "Cuenta creada",
      description: "Email verificado correctamente.",
      state: "completed" as const,
      icon: "i-lucide-check",
    },
    {
      title: "Organizacion configurada",
      description: organizationName,
      state: "completed" as const,
      icon: "i-lucide-check",
    },
    {
      title: "Comprobante recibido",
      description: submittedAt
        ? `Enviado el ${submittedAt}.`
        : "Tu comprobante quedo registrado correctamente.",
      state: "completed" as const,
      icon: "i-lucide-check",
    },
    {
      title: "Validacion de pago",
      description: "Nuestro equipo esta revisando tu comprobante.",
      state: "active" as const,
      icon: "i-lucide-loader-circle",
    },
    {
      title: "Cuenta activa",
      description: "Acceso completo a todas las funciones de NexusPOS.",
      state: "pending" as const,
      icon: "i-lucide-lock",
    },
  ];
});

const openSupport = () => {
  supportOpen.value = true;
};

const checkStatus = async () => {
  await refreshActivationStatus();
};

const goToTour = async () => {
  await navigateTo("/dashboard?status=pending", { replace: false });
};

onMounted(async () => {
  const canAccess = await ensureSuccessAccess();
  if (!canAccess) {
    return;
  }

  await loadSuccessState({ logAccess: true });
  startActivationPolling();
});
</script>

<template>
  <AuthLayout
    eyebrow="Listo para revision"
    title="Registro casi completo."
    description="Estamos validando tu pago. Recibiras un email cuando tu cuenta este activa."
    :feature-items="[]"
  >
    <div class="space-y-6">
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-52 rounded-[2rem]" />
        <USkeleton class="h-72 rounded-[2rem]" />
        <USkeleton class="h-64 rounded-[2rem]" />
      </div>

      <template v-else>
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="No pudimos cargar tu estado de activacion"
          :description="error"
        />

        <UCard class="admin-shell-panel overflow-hidden rounded-[2rem]">
          <div class="space-y-6 p-2 text-center">
            <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <UIcon name="i-lucide-badge-check" class="h-11 w-11" />
            </div>

            <div class="space-y-3">
              <h1 class="text-3xl font-semibold text-slate-950 dark:text-white md:text-4xl">
                Registro casi completo
              </h1>
              <p class="mx-auto max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
                Estamos validando tu pago. Recibiras un email cuando tu cuenta este activa.
              </p>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-3">
              <UBadge color="warning" variant="soft" size="lg" class="rounded-full px-4 py-2">
                <UIcon name="i-lucide-clock-3" class="mr-2 h-4 w-4" />
                Tiempo estimado: &lt;1 hora habil
              </UBadge>

              <UBadge color="primary" variant="soft" size="lg" class="rounded-full px-4 py-2">
                <UIcon name="i-lucide-refresh-cw" class="mr-2 h-4 w-4" :class="checkingStatus ? 'animate-spin' : ''" />
                {{ formattedLastCheckedAt ? `Ultima verificacion: ${formattedLastCheckedAt}` : "Verificando estado" }}
              </UBadge>
            </div>

            <div class="mx-auto max-w-xl space-y-2">
              <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Progreso del onboarding</span>
                <span>4/5 completado</span>
              </div>
              <UProgress :model-value="80" color="primary" />
            </div>
          </div>
        </UCard>

        <UCard class="admin-shell-panel rounded-[1.75rem]">
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Tu proceso de registro</h2>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {{ state?.organization.name ?? "Tu cuenta" }} ya esta en revision final.
                </p>
              </div>

              <UBadge color="warning" variant="soft" class="rounded-full px-3 py-1">
                Pendiente de activacion
              </UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <TimelineStep
              v-for="step in timelineSteps"
              :key="step.title"
              :title="step.title"
              :description="step.description"
              :state="step.state"
              :icon="step.icon"
            />
          </div>
        </UCard>

        <UCard class="rounded-[1.75rem] border-2 border-amber-400/80 bg-white/95 dark:border-amber-500/70 dark:bg-slate-950/60">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <UIcon name="i-lucide-info" class="h-5 w-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Estado actual: Pendiente de activacion</h2>
                <p class="text-sm text-slate-600 dark:text-slate-300">
                  Tu cuenta esta parcialmente activa mientras validamos el pago.
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-5">
            <p class="text-sm leading-7 text-slate-700 dark:text-slate-300">
              Puedes avanzar con configuraciones internas y explorar NexusPOS, pero las operaciones reales seguiran bloqueadas hasta que tu organizacion cambie a estado activo.
            </p>

            <div class="grid gap-4 lg:grid-cols-2">
              <StatusCard
                title="Lo que si puedes hacer"
                icon="i-lucide-check-circle-2"
                tone="success"
                :items="availableItems"
              />

              <StatusCard
                title="Lo que aun no esta disponible"
                icon="i-lucide-lock"
                tone="error"
                :items="restrictedItems"
              />
            </div>
          </div>
        </UCard>

        <UCard class="admin-shell-panel rounded-[1.75rem]">
          <template #header>
            <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Que sucede ahora</h2>
          </template>

          <div class="space-y-5">
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 font-semibold text-primary-700 dark:text-primary-300">1</div>
              <div>
                <p class="font-medium text-slate-950 dark:text-white">Revision de comprobante</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Nuestro equipo validara tu comprobante en menos de 1 hora habil.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 font-semibold text-primary-700 dark:text-primary-300">2</div>
              <div>
                <p class="font-medium text-slate-950 dark:text-white">Email de activacion</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Recibiras un correo confirmando que tu cuenta ya puede operar normalmente.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 font-semibold text-primary-700 dark:text-primary-300">3</div>
              <div>
                <p class="font-medium text-slate-950 dark:text-white">Operacion completa</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Cuando se active la cuenta, podras vender, agendar citas y habilitar el portal para clientes.
                </p>
              </div>
            </div>

            <UAlert
              color="info"
              variant="soft"
              icon="i-lucide-bell-ring"
              title="Te notificaremos por email"
              description="Revisa tu bandeja de entrada y spam. En Fase 2 integraremos notificaciones y centro de ayuda automatizado."
            />

            <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              <p><span class="font-semibold text-slate-950 dark:text-white">Organizacion:</span> {{ state?.organization.name ?? "Pendiente" }}</p>
              <p v-if="formattedSubmittedAt" class="mt-1"><span class="font-semibold text-slate-950 dark:text-white">Comprobante enviado:</span> {{ formattedSubmittedAt }}</p>
              <p v-if="formattedPeriodEnd" class="mt-1"><span class="font-semibold text-slate-950 dark:text-white">Periodo actual hasta:</span> {{ formattedPeriodEnd }}</p>
            </div>
          </div>
        </UCard>

        <div class="grid gap-4 sm:grid-cols-2">
          <UButton
            to="/dashboard?status=pending"
            color="primary"
            size="lg"
            block
            icon="i-lucide-layout-dashboard"
            class="justify-center"
          >
            Ir a mi Dashboard
          </UButton>

          <UButton
            variant="outline"
            color="neutral"
            size="lg"
            block
            icon="i-lucide-graduation-cap"
            class="justify-center"
            @click="goToTour"
          >
            Ver Tour Guiado
          </UButton>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-3 text-sm">
          <UButton variant="link" color="neutral" @click="openSupport">
            <UIcon name="i-lucide-message-circle-heart" class="mr-1 h-4 w-4" />
            Contactar soporte
          </UButton>

          <UButton variant="link" color="neutral" disabled>
            <UIcon name="i-lucide-book-open-text" class="mr-1 h-4 w-4" />
            Centro de ayuda (Fase 2)
          </UButton>

          <UButton variant="link" color="neutral" :loading="checkingStatus" @click="checkStatus">
            <UIcon name="i-lucide-refresh-cw" class="mr-1 h-4 w-4" />
            Verificar estado
          </UButton>
        </div>

        <UModal
          :open="supportOpen"
          title="Soporte NexusPOS"
          description="Placeholder para chat en tiempo real y seguimiento automatizado en Fase 2."
          @update:open="supportOpen = $event"
        >
          <template #body>
            <div class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Escribenos a <a class="font-semibold text-primary-700 dark:text-primary-300" href="mailto:soporte@nexuspos.app">soporte@nexuspos.app</a>.</p>
              <p>Si tu validacion demora mas de 1 hora habil, incluye el nombre de tu organizacion y la referencia de pago en el mensaje.</p>
            </div>
          </template>
        </UModal>
      </template>
    </div>
  </AuthLayout>
</template>
