<script setup lang="ts">

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "dashboard.view",
  roles: ["admin", "manager", "employee"],
  moduleKey: "dashboard",
});

const route = useRoute();
const { user, profile: authProfile } = useAuth();
const dashboardMounted = ref(false);
const { accountStatus, setAccountStatusState } = useUserContext();
const { hasModuleAccess } = usePermissions();
const { loadAccountStatus: loadSharedAccountStatus } = useAccountStatus();
const { profile: globalProfile } = useGlobalUserProfile();
const { stats: dashboardStats, period, loading: loadingStats } = useDashboardStats();
type DashboardProfile = {
  full_name?: string | null;
  role?: string | null;
  organization_id?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  employee: "Empleado",
  client: "Cliente",
};

const profile = computed<DashboardProfile | null>(() => {
  return (globalProfile.value as DashboardProfile | null) ?? (authProfile.value as DashboardProfile | null);
});

const dashboardUserMetadata = computed<Record<string, unknown>>(() =>
  (user.value?.user_metadata as Record<string, unknown> | undefined) ?? {},
);

const dashboardDisplayName = computed(() => {
  const profileName = profile.value?.full_name?.trim();
  const metadataName = typeof dashboardUserMetadata.value.full_name === "string"
    ? dashboardUserMetadata.value.full_name.trim()
    : "";

  return profileName || metadataName || "Usuario";
});

const dashboardRoleLabel = computed(() => {
  const profileRole = profile.value?.role?.trim() ?? "";
  const metadataRole = typeof dashboardUserMetadata.value.role === "string"
    ? dashboardUserMetadata.value.role.trim()
    : "";

  return ROLE_LABELS[profileRole || metadataRole] || "Usuario";
});

const activityItems = [
  {
    title: "Nuevo pedido realizado",
    time: "Hace 5 minutos",
    icon: "i-heroicons-shopping-bag",
    iconWrapperClass: "bg-blue-50 dark:bg-blue-950/40",
    iconClass: "text-blue-600 dark:text-blue-300",
  },
  {
    title: "Usuario registrado",
    time: "Hace 15 minutos",
    icon: "i-heroicons-user-plus",
    iconWrapperClass: "bg-emerald-50 dark:bg-emerald-950/40",
    iconClass: "text-emerald-600 dark:text-emerald-300",
  },
] as const;

const kpiItems = computed(() => [
  {
    label: "Ventas Totales",
    value: `$${Number(dashboardStats.value?.sales ?? 0).toLocaleString()}`,
    icon: "i-heroicons-currency-dollar",
    tone: "emerald" as const,
  },
  {
    label: "Pedidos",
    value: Number(dashboardStats.value?.appointments ?? 0).toLocaleString(),
    icon: "i-heroicons-shopping-bag",
    tone: "sky" as const,
  },
  {
    label: "Productos",
    value: Number(dashboardStats.value?.products ?? 0).toLocaleString(),
    icon: "i-heroicons-archive-box",
    tone: "fuchsia" as const,
  },
  {
    label: "Usuarios",
    value: Number(dashboardStats.value?.customers ?? 0).toLocaleString(),
    icon: "i-heroicons-users",
    tone: "amber" as const,
  },
]);

const quickActions = computed(() => {
  const items = [];

  if (hasModuleAccess("appointments")) {
    items.push({
      label: "Abrir agenda",
      description: "Revisa citas, disponibilidad y cambios del dia.",
      icon: "i-lucide-calendar-days",
      to: "/appointments",
      colorClass: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300",
    });
  }

  if (hasModuleAccess("pos.sales")) {
    items.push({
      label: "Ir a Ventas",
      description: "Inicia una venta rapida o revisa el flujo operativo.",
      icon: "i-lucide-shopping-cart",
      to: "/pos/sell",
      colorClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    });
  }

  if (hasModuleAccess("users")) {
    items.push({
      label: "Gestionar usuarios",
      description: "Administra accesos, roles y estructura del equipo.",
      icon: "i-lucide-users",
      to: "/users",
      colorClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    });
  }

  if (hasModuleAccess("reports.sales") || hasModuleAccess("reports.services") || hasModuleAccess("reports.lodging")) {
    items.push({
      label: "Ver reportes",
      description: "Consulta indicadores y exportables segun tu alcance.",
      icon: "i-lucide-bar-chart-3",
      to: "/reports",
      colorClass: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
    });
  }

  items.push({
    label: "Actualizar perfil",
    description: "Manten al dia tu informacion operativa y de contacto.",
    icon: "i-lucide-user-round",
    to: "/profile",
    colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  });

  return items.slice(0, 4);
});

const checkingStatus = ref(false);

const normalizeAccountStatus = (
  status: string | null | undefined,
): AccountStatusValue => {
  if (
    status === "pending" ||
    status === "active" ||
    status === "rejected" ||
    status === "suspended"
  ) {
    return status;
  }

  return "active";
};

const loadAccountStatus = async (force = false) => {
  checkingStatus.value = true;
  try {
    const result = await loadSharedAccountStatus({
      organizationId: profile.value?.organization_id ?? null,
      forcedStatus: typeof route.query.status === "string" ? route.query.status : null,
      force,
    });
    setAccountStatusState({
      accountStatus: result.accountStatus,
      paymentRequired: result.paymentRequired,
    });
  } finally {
    checkingStatus.value = false;
  }
};

onMounted(async () => {
  dashboardMounted.value = true;
  const routeStatus = normalizeAccountStatus(
    typeof route.query.status === "string" ? route.query.status : null,
  );

  if (routeStatus !== "active") {
    setAccountStatusState({
      accountStatus: routeStatus,
      paymentRequired: false,
    });
  }
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <template v-if="dashboardMounted">
    <DashboardPendingBanner
      v-if="accountStatus !== 'active'"
      :account-status="accountStatus"
      :checking-status="checkingStatus"
      @check="() => loadAccountStatus(true)"
    />

    <UiPageHeader
      eyebrow="Panel operativo"
      title="Dashboard"
      :description="`Bienvenido de vuelta, ${dashboardDisplayName}. Este resumen concentra actividad, modulos habilitados y senales operativas de tu organizacion.`"
      surface
    >
      <template #meta>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Periodo KPI
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {{ period }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Estado
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {{ accountStatus === 'active' ? 'Operativo' : 'En revision' }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Rol actual
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {{ dashboardRoleLabel }}
            </p>
          </div>
        </div>
      </template>
    </UiPageHeader>

    <USkeleton v-if="loadingStats" class="h-4 w-40 rounded-full" />

    <UiKpiStrip :items="kpiItems" />

    <UiQuickActions
      v-if="quickActions.length > 0"
      title="Acciones rapidas"
      description="Atajos utiles para continuar tu operacion sin perder tiempo navegando."
      :actions="quickActions"
    />

    <UiSectionShell
      eyebrow="Seguimiento"
      title="Actividad reciente"
      description="Ultimos eventos visibles dentro de tu operacion."
    >
      <UiActivityList :items="activityItems" />
    </UiSectionShell>
    </template>

    <UCard v-else class="rounded-[1.75rem]">
      <div class="space-y-4 py-2">
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="h-32 w-full rounded-2xl" />
        <USkeleton class="h-32 w-full rounded-2xl" />
      </div>
    </UCard>
  </div>
</template>
