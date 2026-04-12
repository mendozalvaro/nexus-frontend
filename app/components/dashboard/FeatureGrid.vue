<script setup lang="ts">
import type { DashboardAccountStatus } from "@/composables/useDashboard";

interface FeatureCardItem {
  key: string;
  title: string;
  description: string;
  caption: string;
  icon: string;
  route: string;
  available: boolean;
  reason?: string;
}

const props = defineProps<{
  accountStatus: DashboardAccountStatus;
  canManageBranches: boolean;
}>();

const emit = defineEmits<{
  navigate: [route: string];
  blocked: [payload: { featureKey: string; route: string }];
}>();

const features = computed<FeatureCardItem[]>(() => [
  {
    key: "catalog",
    title: "Productos",
    caption: "Gestiona tu catalogo",
    description:
      "Agrega productos, define precios base y deja listo tu inventario para el arranque.",
    icon: "i-heroicons-archive-box",
    route: "/inventory",
    available: true,
  },
  {
    key: "employees",
    title: "Empleados",
    caption: "Configura tu equipo",
    description:
      "Registra colaboradores y prepara su estructura antes de comenzar a operar.",
    icon: "i-heroicons-users",
    route: "/users",
    available: true,
  },
  {
    key: "branches",
    title: "Sucursales",
    caption: "Administra sedes",
    description:
      "Configura la sucursal principal y revisa el alcance multi-sucursal de tu plan.",
    icon: "i-heroicons-building-storefront",
    route: "/branches",
    available: props.canManageBranches,
    reason: "Disponible cuando tu plan habilita gestion multi-sucursal.",
  },
  {
    key: "sales",
    title: "Punto de Venta",
    caption: "Procesa ventas",
    description:
      "Vende productos y servicios en una sola transaccion cuando la cuenta este activa.",
    icon: "i-heroicons-shopping-cart",
    route: "/pos",
    available: props.accountStatus === "active",
    reason: "Requiere cuenta activa para procesar cobros reales.",
  },
  {
    key: "appointments",
    title: "Citas",
    caption: "Agenda operativa",
    description:
      "Organiza reservas reales y disponibilidad del equipo despues de la activacion.",
    icon: "i-heroicons-calendar-days",
    route: "/appointments",
    available: props.accountStatus === "active",
    reason: "Las citas reales quedan bloqueadas hasta validar el pago.",
  },
  {
    key: "reports",
    title: "Reportes",
    caption: "Indicadores avanzados",
    description:
      "Visualiza ventas, servicios y citas con datos reales una vez activada la cuenta.",
    icon: "i-heroicons-chart-bar-square",
    route: "/reports",
    available: props.accountStatus === "active",
    reason: "Los reportes avanzados se habilitan tras la activacion.",
  },
]);

const handleCardClick = (feature: FeatureCardItem) => {
  if (feature.available) {
    emit("navigate", feature.route);
    return;
  }

  emit("blocked", { featureKey: feature.key, route: feature.route });
};
</script>

<template>
  <div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
    <UCard
      v-for="feature in features"
      :key="feature.key"
      class="relative overflow-hidden rounded-[1.5rem] transition hover:shadow-lg"
      :class="feature.available ? 'cursor-pointer' : ''"
      @click="handleCardClick(feature)"
    >
      <template #header>
        <div class="flex items-center gap-3" :class="feature.available ? '' : 'opacity-60'">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900">
            <UIcon :name="feature.icon" class="h-6 w-6 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h3 class="font-bold text-slate-950 dark:text-white">{{ feature.title }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ feature.caption }}</p>
          </div>
        </div>
      </template>

      <p class="mb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {{ feature.description }}
      </p>

      <UButton
        :variant="feature.available ? 'soft' : 'ghost'"
        color="neutral"
        block
        :icon="feature.available ? 'i-heroicons-arrow-right' : 'i-heroicons-lock-closed'"
        trailing
        :disabled="false"
      >
        {{ feature.available ? "Abrir" : "Bloqueado por activacion" }}
      </UButton>

      <div
        v-if="!feature.available"
        class="absolute inset-0 flex items-center justify-center bg-slate-50/78 backdrop-blur-[1px] dark:bg-slate-950/80"
        :title="feature.reason"
      >
        <div class="max-w-[14rem] rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
          <UIcon name="i-heroicons-lock-closed" class="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Requiere cuenta activa</p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ feature.reason }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
