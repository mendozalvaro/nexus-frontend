<script setup lang="ts">
import type { NavigationItem } from "@/types/permissions";
import type { Database } from "@/types/database.types";

import { NAVIGATION_ITEMS, PENDING_ACTIVATION_PATH, SYSTEM_NAVIGATION_ITEMS } from "@/config/navigation";
import { roleDefinitions } from "@/utils/roles";

const colorMode = useColorMode();
const route = useRoute();
const mobileMenuOpen = ref(false);
const sidebarCollapsed = ref(false);
const layoutMounted = ref(false);
const SIDEBAR_COLLAPSED_STORAGE_KEY = "nexuspos:layout:sidebar-collapsed";

const { user, profile, resolvedRole, signOut } = useAuth();
const { profile: globalProfile } = useGlobalUserProfile();
const { organization: globalOrganization } = useGlobalOrganization();
const { resolveActorContext } = useActorContext();
const {
  accountStatus,
  paymentRequired,
  setAccountStatusState,
} = useUserContext();
const { getUserPermissions, hasPermission, hasModuleAccess } = usePermissions();
const { loadAccountStatus: loadSharedAccountStatus } = useAccountStatus();
const { isFeatureEnabled } = useFeatureFlags();
const { hasBusinessType } = useBusinessTypes();

type UserMenuItem = {
  label: string;
  icon: string;
  to?: string;
  onSelect?: () => void | Promise<void>;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  employee: "Empleado",
  client: "Cliente",
};

const colorModeIcon = computed(() =>
  colorMode.preference === "dark" ? "i-heroicons-sun" : "i-heroicons-moon",
);

const isSystemArea = computed(() => route.path.startsWith("/system"));

const effectiveProfile = computed(() => {
  return (globalProfile.value as typeof profile.value) ?? profile.value;
});

const currentOrganization = computed<Database["public"]["Tables"]["organizations"]["Row"] | null>(() =>
  (globalOrganization.value as Database["public"]["Tables"]["organizations"]["Row"] | null) ?? null,
);

const currentUserRoleLabel = computed(() => {
  if (isSystemArea.value) {
    return "System";
  }

  const profileRole = (effectiveProfile.value as { role?: string | null } | null)?.role?.trim() ?? "";
  const metadataRole = typeof currentUserMetadata.value.role === "string"
    ? currentUserMetadata.value.role.trim()
    : "";
  const resolvedAuthRole = resolvedRole.value === "guest" ? "" : resolvedRole.value;
  const role = profileRole || metadataRole || resolvedAuthRole;
  return ROLE_LABELS[role] ?? "Usuario del sistema";
});

watch(
  () => [route.path, user.value?.id ?? null] as const,
  async ([path, userId]) => {
    if (!userId || !path.startsWith("/system")) {
      return;
    }

    await resolveActorContext({ preferSystem: true, requireProfile: false });
  },
  { immediate: true },
);

const currentRoleDefinition = computed(() => {
  const role = (effectiveProfile.value as { role?: keyof typeof roleDefinitions | null } | null)?.role as keyof typeof roleDefinitions | undefined;
  return role ? roleDefinitions[role] : null;
});

const dashboardHomePath = computed(() => {
  if (isSystemArea.value) {
    return "/system";
  }

  return currentRoleDefinition.value?.homePath ?? "/dashboard";
});

const showUserMenu = computed(() => Boolean(user.value || effectiveProfile.value));
const showResolvedUserMenu = computed(() => layoutMounted.value && showUserMenu.value);

const currentUserMetadata = computed<Record<string, unknown>>(() =>
  (user.value?.user_metadata as Record<string, unknown> | undefined) ?? {},
);

const currentUserName = computed(() => {
  const profileName = (effectiveProfile.value as { full_name?: string | null } | null)?.full_name?.trim();
  const metadataName = typeof currentUserMetadata.value.full_name === "string"
    ? currentUserMetadata.value.full_name.trim()
    : "";
  const email = user.value?.email?.trim() ?? "";

  return profileName || metadataName || email || "Cuenta";
});

const userInitials = computed(() => {
  const source = currentUserName.value || "NexusPOS";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "NP";
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "NP";
});

const normalizeAccountStatus = (status: string | null | undefined): AccountStatusValue => {
  if (status === "pending" || status === "active" || status === "rejected" || status === "suspended") {
    return status;
  }

  return "active";
};

const getRouteAccountStatus = () =>
  normalizeAccountStatus(typeof route.query.status === "string" ? route.query.status : null);

const isPendingActivationRequired = computed(() =>
  accountStatus.value === "pending" ||
  accountStatus.value === "rejected" ||
  accountStatus.value === "suspended",
);

const activationPath = computed(() => {
  if (accountStatus.value === "rejected") {
    return "/dashboard?status=rejected";
  }

  if (accountStatus.value === "suspended") {
    return "/dashboard?status=suspended";
  }

  return PENDING_ACTIVATION_PATH;
});

const activationBadge = computed(() => {
  if (accountStatus.value === "rejected") {
    return "Pago rechazado";
  }

  if (accountStatus.value === "suspended") {
    return "Cuenta suspendida";
  }

  return "Activa tu cuenta";
});

const navigationItems = computed<NavigationItem[]>(() => {
  if (isSystemArea.value) {
    return SYSTEM_NAVIGATION_ITEMS;
  }

  const currentRole = profile.value?.role;
  const permissions = getUserPermissions();

  return NAVIGATION_ITEMS.filter((item) => {
    if (item.roles && (!currentRole || !item.roles.includes(currentRole))) {
      return false;
    }

    if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) {
      return false;
    }

    if (
      item.requiredBusinessTypes
      && item.requiredBusinessTypes.length > 0
      && !item.requiredBusinessTypes.some((businessType) => hasBusinessType(businessType))
    ) {
      return false;
    }

    if (item.moduleKey && !hasModuleAccess(item.moduleKey)) {
      return false;
    }

    if (item.moduleKeysAny && !item.moduleKeysAny.some((moduleKey) => hasModuleAccess(moduleKey))) {
      return false;
    }

    if (item.permission && !hasPermission(permissions, item.permission)) {
      return false;
    }

    return true;
  }).map((item) => {
    const shouldShowActivationState =
      isPendingActivationRequired.value &&
      item.pendingAccess === "activation";

    if (!shouldShowActivationState) {
      return item;
    }

    return {
      ...item,
      to: activationPath.value,
      activationTo: activationPath.value,
      disabled: true,
      badge: activationBadge.value,
    };
  });
});

const renderedNavigationItems = computed<NavigationItem[]>(() => navigationItems.value);
const stableNavigationItems = computed<NavigationItem[]>(() =>
  layoutMounted.value ? renderedNavigationItems.value : [],
);

const userMenuItems = computed<UserMenuItem[][]>(() => {
  const profilePath = isSystemArea.value
    ? "/system/profile"
    : currentRoleDefinition.value?.profilePath ?? "/profile";

  const items: UserMenuItem[][] = [
    [
      {
        label: "Perfil",
        icon: "i-heroicons-user-circle",
        to: profilePath,
      },
    ],
  ];

  if (navigationItems.value.some((item) => item.to === (currentRoleDefinition.value?.settingsPath ?? "/settings"))) {
    items[0]?.push({
      label: "Configuracion",
      icon: "i-heroicons-cog-6-tooth",
      to: currentRoleDefinition.value?.settingsPath ?? "/settings",
    });
  }

  items.push([
    {
      label: "Cerrar sesion",
      icon: "i-heroicons-arrow-right-on-rectangle",
      onSelect: async () => {
        await signOut();
      },
    },
  ]);

  return items;
});

const toggleColorMode = () => {
  colorMode.preference = colorMode.preference === "dark" ? "light" : "dark";
};

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  if (import.meta.client) {
    localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      JSON.stringify(sidebarCollapsed.value),
    );
  }
};

const restoreSidebarPreference = () => {
  if (!import.meta.client) {
    return;
  }

  try {
    const rawValue = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    sidebarCollapsed.value = rawValue ? JSON.parse(rawValue) === true : false;
  } catch {
    localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    sidebarCollapsed.value = false;
  }
};

const loadAccountStatus = async (force = false) => {
  const result = await loadSharedAccountStatus({
    organizationId: profile.value?.organization_id ?? null,
    forcedStatus: getRouteAccountStatus(),
    force,
  });
  setAccountStatusState({
    accountStatus: result.accountStatus,
    paymentRequired: result.paymentRequired,
  });
};

const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
};


watch(
  () => route.query.status,
  async () => {
    setAccountStatusState({
      accountStatus: getRouteAccountStatus(),
      paymentRequired: paymentRequired.value,
    });

    if (!user.value?.id) {
      return;
    }

    await loadAccountStatus();
  },
);

watch(
  () => (globalProfile.value as { organization_id?: string | null } | null)?.organization_id ?? profile.value?.organization_id ?? null,
  async (organizationId) => {
    if (!organizationId || !user.value?.id) {
      return;
    }

    await loadAccountStatus();
  },
  { immediate: true },
);

if (import.meta.client) {
  onMounted(() => {
    layoutMounted.value = true;
    restoreSidebarPreference();
  });
}
</script>

<template>
  <div
    class="min-h-screen overflow-x-clip bg-slate-50 text-slate-950 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-50">
    <header
      class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div class="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-20 lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <UButton variant="ghost" color="neutral" icon="i-heroicons-bars-3" aria-label="Abrir menu"
            class="shrink-0 rounded-2xl lg:hidden" @click="mobileMenuOpen = true" />

          <NuxtLink v-slot="{ href, navigate }" :to="dashboardHomePath" custom>
            <a :href="href ?? undefined" class="flex items-center gap-3" @click="navigate">
              <div
                class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-sky-500 text-sm font-bold text-white shadow-lg shadow-sky-500/30">
                <img
                  v-if="currentOrganization?.logo_url"
                  :src="currentOrganization.logo_url"
                  :alt="currentOrganization.name"
                  class="h-full w-full object-cover"
                >
                <span v-else>NP</span>
              </div>
              <div class="hidden min-w-0 sm:block">
                <p class="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">
                  NexusPOS
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Plataforma operativa multi-tenant
                </p>
              </div>
            </a>
          </NuxtLink>
        </div>

        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          <div class="relative" title="Notificaciones proximamente">
            <UButton variant="ghost" color="neutral" icon="i-heroicons-bell" aria-label="Notificaciones"
              class="min-h-11 min-w-11 rounded-2xl" />
            <span
              class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
          </div>

          <UButton variant="ghost" color="neutral" :icon="colorModeIcon" aria-label="Cambiar modo de color"
            class="min-h-11 min-w-11 rounded-2xl" @click="toggleColorMode" />

          <UDropdownMenu v-if="showResolvedUserMenu" :items="userMenuItems">
            <button type="button"
              class="group flex min-h-11 items-center gap-2 rounded-2xl px-1.5 py-1 text-left transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/70 sm:gap-3 sm:px-2"
              aria-label="Menu de usuario">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                {{ userInitials }}
              </div>
              <div class="hidden min-w-0 sm:block">
                <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {{ currentUserName }}
                </p>
                <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {{ currentUserRoleLabel }}
                </p>
              </div>
              <UIcon name="i-heroicons-chevron-down"
                class="hidden h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 sm:block" />
            </button>
          </UDropdownMenu>
          <div
            v-else
            class="flex min-h-11 items-center gap-2 rounded-2xl px-1.5 py-1 sm:gap-3 sm:px-2"
            aria-hidden="true"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              --
            </div>
            <div class="hidden min-w-0 sm:block">
              <p class="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
                Cargando cuenta
              </p>
              <p class="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                ...
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-[1600px] lg:gap-6 lg:px-8">
      <aside class="relative hidden shrink-0 bg-transparent py-6 transition-[width,padding] duration-300 ease-in-out lg:block"
        :class="sidebarCollapsed ? 'w-24 px-3' : 'w-72 px-4'">
        <button
          type="button"
          class="absolute -right-3 top-10 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:bg-sky-50 hover:text-sky-600 hover:shadow-md hover:shadow-sky-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-750 dark:hover:text-sky-400"
          :aria-label="sidebarCollapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'"
          @click="toggleSidebar"
        >
          <UIcon name="i-heroicons-chevron-left-20-solid" class="h-3.5 w-3.5 transition-transform duration-300" :class="sidebarCollapsed ? 'rotate-180' : ''" />
        </button>

        <Transition name="sidebar-fade">
          <div v-if="!sidebarCollapsed" class="mb-3">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Navegacion
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Modulos disponibles para tu rol
            </p>
          </div>
        </Transition>

        <LayoutSidebarNav :items="stableNavigationItems" :collapsed="sidebarCollapsed" />
      </aside>

      <div class="flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col">
        <main class="flex-1 px-4 py-6 pb-10 sm:px-6 md:py-8 lg:px-2 lg:py-8 lg:pb-24">
          <slot />
        </main>

        <LayoutAppFooter />
      </div>
    </div>

    <div
      v-if="paymentRequired && !route.path.startsWith('/onboarding/payment')"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <UCard class="w-full max-w-lg rounded-3xl border border-amber-300 bg-white p-2 dark:border-amber-700 dark:bg-slate-900">
        <div class="space-y-4 p-4">
          <div class="flex items-start gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <UIcon name="i-lucide-credit-card" class="h-5 w-5" />
            </div>
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Pago requerido</p>
              <h2 class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Tu prueba finalizó o no tienes una suscripción activa</h2>
            </div>
          </div>

          <p class="text-sm text-slate-600 dark:text-slate-300">
            Para continuar usando los módulos de la app, debes completar el pago y activar tu suscripción.
          </p>

          <UButton to="/onboarding/payment" color="primary" block size="lg" class="min-h-11">
            Ir a pago
          </UButton>
        </div>
      </UCard>
    </div>

    <USlideover v-if="mobileMenuOpen" :open="mobileMenuOpen" side="left" @update:open="mobileMenuOpen = $event">
      <template #header>
        <div class="w-full space-y-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-sky-500 text-sm font-bold text-white">
              <img
                v-if="currentOrganization?.logo_url"
                :src="currentOrganization.logo_url"
                :alt="currentOrganization.name"
                class="h-full w-full object-cover"
              >
              <span v-else>NP</span>
            </div>
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">
                NexusPOS
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Navegacion principal
              </p>
            </div>
          </div>

        </div>
      </template>

      <template #body>
        <div class="space-y-5 px-1 pb-4">
          <LayoutSidebarNav :items="stableNavigationItems" @navigate="closeMobileMenu" />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.sidebar-fade-enter-active,
.sidebar-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.sidebar-fade-enter-from,
.sidebar-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
