<script setup lang="ts">
definePageMeta({
  layout: "client",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["client"],
});

const { profile } = useAuth();

const kpiItems = [
  {
    label: "Citas activas",
    value: "0",
    icon: "i-heroicons-calendar-days",
    tone: "sky" as const,
  },
  {
    label: "Reservas",
    value: "0",
    icon: "i-heroicons-ticket",
    tone: "emerald" as const,
  },
  {
    label: "Servicios",
    value: "0",
    icon: "i-heroicons-sparkles",
    tone: "fuchsia" as const,
  },
];

const quickActions = [
  {
    label: "Ver mis citas",
    description: "Consulta tus reservas, horarios y proximas visitas.",
    icon: "i-lucide-calendar-days",
    to: "/client/appointments",
    colorClass: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300",
  },
  {
    label: "Explorar reservas",
    description: "Revisa disponibilidad y proximas opciones para reservar.",
    icon: "i-lucide-ticket",
    to: "/client/bookings",
    colorClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    label: "Actualizar perfil",
    description: "Manten tu informacion de contacto y preferencias al dia.",
    icon: "i-lucide-user-round",
    to: "/client/profile",
    colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
];

const activityItems = [
  {
    title: "Portal listo para reservar",
    time: "Disponible ahora",
    icon: "i-heroicons-bolt",
    iconWrapperClass: "bg-emerald-50 dark:bg-emerald-950/40",
    iconClass: "text-emerald-600 dark:text-emerald-300",
  },
  {
    title: "Perfil sincronizado",
    time: "Hace unos segundos",
    icon: "i-heroicons-user-circle",
    iconWrapperClass: "bg-sky-50 dark:bg-sky-950/40",
    iconClass: "text-sky-600 dark:text-sky-300",
  },
] as const;
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiPageHeader
      eyebrow="Portal cliente"
      title="Mi portal"
      :description="`Hola, ${profile?.full_name}. Desde aqui puedes revisar tus citas, seguir reservas y mantener tu informacion personal actualizada.`"
      surface
    >
      <template #meta>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Estado de acceso
          </p>
          <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            Cliente activo
          </p>
        </div>
      </template>
    </UiPageHeader>

    <UiKpiStrip :items="kpiItems" />

    <UiQuickActions
      title="Acciones recomendadas"
      description="Accesos directos para seguir tu experiencia dentro del portal."
      :actions="quickActions"
    />

    <UiSectionShell
      eyebrow="Seguimiento"
      title="Actividad reciente"
      description="Eventos visibles dentro de tu portal personal."
    >
      <UiActivityList :items="activityItems" />
    </UiSectionShell>
  </div>
</template>
