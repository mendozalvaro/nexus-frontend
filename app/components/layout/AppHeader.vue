<script setup lang="ts">
import type { User } from "@supabase/supabase-js";

import type { Profile } from "../../types/auth";
import type { Database } from "../../types/database.types";

import { formatRoleLabel } from "../../utils/role-access";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type UserRole = Database["public"]["Enums"]["user_role"];

const route = useRoute();
const { toggle, resolvedTheme } = useTheme();

const props = withDefaults(
  defineProps<{
    user?: User | null;
    profile?: Profile | null;
    organization?: Organization | null;
    homePath: string;
    profilePath: string;
    settingsPath: string;
    showBreadcrumbs?: boolean;
    showNotifications?: boolean;
    simplified?: boolean;
    isLoading?: boolean;
  }>(),
  {
    user: null,
    profile: null,
    organization: null,
    showBreadcrumbs: true,
    showNotifications: true,
    simplified: false,
    isLoading: false,
  },
);

const emit = defineEmits<{
  menu: [];
  logout: [];
}>();

const menuOpen = ref(false);

const initials = computed(() => {
  const source = props.profile?.full_name ?? props.user?.email ?? "NexusPOS";

  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");
});

const roleLabel = computed(() => formatRoleLabel(props.profile?.role as UserRole | null | undefined));
const organizationName = computed(() => props.organization?.name ?? "NexusPOS");
const notificationCount = computed(() => 3);

const breadcrumbItems = computed(() => {
  return route.path
    .split("/")
    .filter(Boolean)
    .map((segment, index, parts) => ({
      label: segment.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      to: `/${parts.slice(0, index + 1).join("/")}`,
    }));
});

const closeUserMenu = () => {
  menuOpen.value = false;
};

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener("keydown", handleEscape);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleEscape);
  });
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeUserMenu();
  }
}
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-950/84">
    <div class="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <UButton color="neutral" variant="ghost" icon="i-lucide-menu"
        class="admin-interactive admin-focus-ring h-10 w-10 rounded-2xl lg:hidden"
        aria-label="Abrir men&uacute; lateral" @click="emit('menu')" />

      <NuxtLink :to="homePath" class="admin-focus-ring admin-interactive flex min-w-0 items-center gap-3 rounded-2xl">
        <div
          class="nexus-logo-shell flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-lg">
          NP
        </div>
        <div class="hidden min-w-0 sm:block">
          <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">NexusPOS</p>
          <p class="truncate text-xs text-slate-600 dark:text-slate-300">{{ organizationName }}</p>
        </div>
      </NuxtLink>

      <div class="min-w-0 flex-1">
        <nav v-if="showBreadcrumbs && !simplified" aria-label="Breadcrumb"
          class="hidden items-center gap-2 overflow-hidden md:flex">
          <template v-for="(item, index) in breadcrumbItems" :key="item.to">
            <NuxtLink :to="item.to"
              class="admin-focus-ring admin-interactive truncate rounded-xl text-sm text-slate-600 hover:text-primary-700 dark:text-slate-300 dark:hover:text-primary-300">
              {{ item.label }}
            </NuxtLink>
            <UIcon v-if="index < breadcrumbItems.length - 1" name="i-lucide-chevron-right"
              class="h-4 w-4 shrink-0 text-slate-400" />
          </template>
        </nav>

        <div v-else class="hidden md:block">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ route.meta.title ?? "Workspace" }}
          </p>
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Operaci&oacute;n segura, multi-tenant y preparada para tu flujo diario.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="ghost"
          :icon="resolvedTheme === 'dark' ? 'i-lucide-sun-medium' : 'i-lucide-moon-star'"
          :aria-label="resolvedTheme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'"
          class="admin-interactive admin-focus-ring h-10 w-10 rounded-2xl" @click="toggle" />

        <div v-if="showNotifications" class="relative">
          <UButton color="neutral" variant="ghost" icon="i-lucide-bell"
            class="admin-interactive admin-focus-ring h-10 w-10 rounded-2xl" aria-label="Notificaciones" />

          <span
            class="absolute right-1.5 top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-semibold text-white">
            {{ notificationCount }}
          </span>
        </div>

        <div class="relative">
          <button type="button"
            class="admin-focus-ring admin-interactive flex items-center gap-3 rounded-2xl border border-slate-200/85 bg-white/90 px-3 py-2 text-left hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/10 dark:border-slate-700/80 dark:bg-slate-900/90 dark:hover:border-primary-500/40"
            aria-haspopup="menu" :aria-expanded="menuOpen" aria-label="Abrir menu de usuario"
            @click="menuOpen = !menuOpen">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition-colors duration-200 dark:bg-slate-800 dark:text-slate-100">
              {{ initials }}
            </div>
            <div class="hidden min-w-0 sm:block">
              <p class="max-w-40 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {{ isLoading ? "Cargando..." : profile?.full_name ?? user?.email ?? "Usuario" }}
              </p>
              <p class="truncate text-xs text-slate-600 dark:text-slate-300">
                {{ roleLabel }}
              </p>
            </div>
            <UIcon name="i-lucide-chevron-down" class="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>

          <Transition enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-1 scale-95 opacity-0" enter-to-class="translate-y-0 scale-100 opacity-100"
            leave-active-class="transition duration-150 ease-in" leave-from-class="translate-y-0 scale-100 opacity-100"
            leave-to-class="translate-y-1 scale-95 opacity-0">
            <div v-if="menuOpen"
              class="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-72 rounded-3xl border border-slate-200/85 bg-white/96 p-3 shadow-2xl shadow-slate-900/10 dark:border-slate-800/90 dark:bg-slate-900/96 dark:shadow-black/30"
              role="menu">
              <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/80">
                <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {{ profile?.full_name ?? user?.email ?? "Usuario" }}
                </p>
                <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ roleLabel }}</p>
              </div>

              <div class="mt-3 flex flex-col gap-1">
                <NuxtLink :to="profilePath"
                  class="admin-focus-ring admin-interactive flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  role="menuitem" @click="closeUserMenu">
                  <UIcon name="i-lucide-user-round" class="h-4 w-4" />
                  Perfil
                </NuxtLink>
                <NuxtLink :to="settingsPath"
                  class="admin-focus-ring admin-interactive flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  role="menuitem" @click="closeUserMenu">
                  <UIcon name="i-lucide-settings-2" class="h-4 w-4" />
                  Configuraci&oacute;n
                </NuxtLink>
                <button type="button"
                  class="admin-focus-ring admin-interactive flex items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  role="menuitem" @click="closeUserMenu(); emit('logout')">
                  <UIcon name="i-lucide-log-out" class="h-4 w-4" />
                  Cerrar sesi&oacute;n
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>
