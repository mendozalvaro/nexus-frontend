<script setup lang="ts">
import type { DashboardAccountStatus } from "@/composables/useDashboard";
import type { Database } from "@/types/database.types";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["admin", "manager", "employee"],
});

const route = useRoute();
const supabase = useSupabaseClient<Database>();
const { profile } = useAuth();
const { getUserPermissions, hasPermission } = usePermissions();

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  employee: "Empleado",
  client: "Cliente",
};

const stats = ref({
  totalSales: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalUsers: 0,
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
    value: `$${stats.value.totalSales.toLocaleString()}`,
    icon: "i-heroicons-currency-dollar",
    tone: "emerald" as const,
  },
  {
    label: "Pedidos",
    value: stats.value.totalOrders.toLocaleString(),
    icon: "i-heroicons-shopping-bag",
    tone: "sky" as const,
  },
  {
    label: "Productos",
    value: stats.value.totalProducts.toLocaleString(),
    icon: "i-heroicons-archive-box",
    tone: "fuchsia" as const,
  },
  {
    label: "Usuarios",
    value: stats.value.totalUsers.toLocaleString(),
    icon: "i-heroicons-users",
    tone: "amber" as const,
  },
]);

const quickActions = computed(() => {
  const permissions = getUserPermissions();
  const items = [];

  if (hasPermission(permissions, "appointments.view")) {
    items.push({
      label: "Abrir agenda",
      description: "Revisa citas, disponibilidad y cambios del dia.",
      icon: "i-lucide-calendar-days",
      to: "/appointments",
      colorClass: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300",
    });
  }

  if (hasPermission(permissions, "pos.view")) {
    items.push({
      label: "Ir al POS",
      description: "Inicia una venta rapida o revisa el flujo operativo.",
      icon: "i-lucide-shopping-cart",
      to: "/pos",
      colorClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    });
  }

  if (hasPermission(permissions, "users.view")) {
    items.push({
      label: "Gestionar usuarios",
      description: "Administra accesos, roles y estructura del equipo.",
      icon: "i-lucide-users",
      to: "/users",
      colorClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    });
  }

  if (hasPermission(permissions, "reports.view")) {
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

const accountStatus = ref<DashboardAccountStatus | "active">("active");
const checkingStatus = ref(false);

const normalizeAccountStatus = (
  status: string | null | undefined,
): DashboardAccountStatus | "active" => {
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

const loadDashboardStats = async () => {
  const permissions = getUserPermissions();

  if (hasPermission(permissions, "reports.view")) {
    // Placeholder for phase 2 dashboard stats.
  }
};

const loadAccountStatus = async () => {
  if (!profile.value?.organization_id) {
    accountStatus.value = "active";
    return;
  }

  const forcedStatus = normalizeAccountStatus(
    typeof route.query.status === "string" ? route.query.status : null,
  );

  checkingStatus.value = true;

  try {
    const [{ data: organization }, { data: subscription }, { data: validation }] = await Promise.all([
      supabase
        .from("organizations")
        .select("status")
        .eq("id", profile.value.organization_id)
        .maybeSingle(),
      supabase
        .from("organization_subscriptions")
        .select("status")
        .eq("organization_id", profile.value.organization_id)
        .maybeSingle(),
      supabase
        .from("payment_validations")
        .select("status, created_at")
        .eq("organization_id", profile.value.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (organization?.status === "suspended") {
      accountStatus.value = "suspended";
      return;
    }

    if (organization?.status === "active" && subscription?.status === "active") {
      accountStatus.value = "active";
      return;
    }

    if (forcedStatus !== "active") {
      accountStatus.value = forcedStatus;
      return;
    }

    if (validation?.status === "rejected") {
      accountStatus.value = "rejected";
      return;
    }

    accountStatus.value = normalizeAccountStatus(organization?.status ?? "pending");
  } finally {
    checkingStatus.value = false;
  }
};

onMounted(async () => {
  const routeStatus = normalizeAccountStatus(
    typeof route.query.status === "string" ? route.query.status : null,
  );

  if (routeStatus !== "active") {
    accountStatus.value = routeStatus;
  }

  await loadDashboardStats();
  await loadAccountStatus();
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <DashboardPendingBanner
      v-if="accountStatus !== 'active'"
      :account-status="accountStatus"
      :checking-status="checkingStatus"
      @check="loadAccountStatus"
    />

    <UiPageHeader
      eyebrow="Panel operativo"
      title="Dashboard"
      :description="`Bienvenido de vuelta, ${profile?.full_name}. Este resumen concentra actividad, modulos habilitados y senales operativas de tu organizacion.`"
      surface
    >
      <template #meta>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
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
              {{ ROLE_LABELS[profile?.role || ''] || 'Usuario' }}
            </p>
          </div>
        </div>
      </template>
    </UiPageHeader>

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
  </div>
</template>
