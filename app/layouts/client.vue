<script setup lang="ts">
import type { NavigationItem } from "@/types/permissions";

import { CLIENT_NAVIGATION_ITEMS } from "@/config/navigation";
import { roleDefinitions } from "@/utils/roles";

const colorMode = useColorMode();
const mobileMenuOpen = ref(false);

const { user, profile, signOut } = useAuth();

type UserMenuItem = {
  label: string;
  icon: string;
  to?: string;
  onSelect?: () => void | Promise<void>;
};

const colorModeIcon = computed(() =>
  colorMode.preference === "dark" ? "i-heroicons-sun" : "i-heroicons-moon",
);

const clientRoleDefinition = computed(() => roleDefinitions.client);

const userInitials = computed(() => {
  const source = profile.value?.full_name?.trim() || user.value?.email?.trim() || "Cliente";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "CL";
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "CL";
});

const navigationItems = computed<NavigationItem[]>(() => CLIENT_NAVIGATION_ITEMS);

const userMenuItems = computed<UserMenuItem[][]>(() => [
  [
    {
      label: "Mi perfil",
      icon: "i-heroicons-user-circle",
      to: clientRoleDefinition.value.profilePath,
    },
  ],
  [
    {
      label: "Cerrar sesion",
      icon: "i-heroicons-arrow-right-on-rectangle",
      onSelect: async () => {
        await signOut();
      },
    },
  ],
]);

const toggleColorMode = () => {
  colorMode.preference = colorMode.preference === "dark" ? "light" : "dark";
};

const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
};
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_38%),linear-gradient(to_bottom,_#f8fafc,_#eef2ff)] text-slate-950 transition-colors duration-200 dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(to_bottom,_#020617,_#0f172a)] dark:text-slate-50">
    <header class="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80">
      <div class="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-heroicons-bars-3"
          aria-label="Abrir menu"
          class="rounded-2xl lg:hidden"
          @click="mobileMenuOpen = true"
        />

        <NuxtLink :to="clientRoleDefinition.homePath" class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-sm font-bold text-white shadow-lg shadow-sky-500/30">
            NP
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
              Portal Cliente
            </p>
            <p class="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
              Reservas, citas y actividad personal
            </p>
          </div>
        </NuxtLink>

        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          <UButton
            variant="ghost"
            color="neutral"
            :icon="colorModeIcon"
            aria-label="Cambiar modo de color"
            class="min-h-11 min-w-11 rounded-2xl"
            @click="toggleColorMode"
          />

          <UDropdownMenu :items="userMenuItems">
            <button
              type="button"
              class="group flex min-h-11 items-center gap-2 rounded-2xl px-1.5 py-1 text-left transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/70 sm:gap-3 sm:px-2"
              aria-label="Menu de usuario"
            >
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                {{ userInitials }}
              </div>
              <div class="hidden min-w-0 sm:block">
                <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {{ profile?.full_name || user?.email || "Cliente" }}
                </p>
                <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  Experiencia personal
                </p>
              </div>
              <UIcon
                name="i-heroicons-chevron-down"
                class="hidden h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 sm:block"
              />
            </button>
          </UDropdownMenu>
        </div>
      </div>
    </header>

    <div class="mx-auto flex max-w-[1500px] gap-6 px-4 sm:px-6 lg:px-8">
      <aside class="hidden w-80 shrink-0 py-6 lg:block">
        <div class="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-lg shadow-slate-200/60 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/70 dark:shadow-black/20">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Espacio personal
            </p>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              Gestiona tu experiencia con total claridad
            </h2>
            <p class="text-sm leading-6 text-slate-500 dark:text-slate-400">
              Consulta tus citas, sigue reservas y mantente al tanto de tu actividad sin entrar al panel operativo interno.
            </p>
          </div>

          <div class="rounded-3xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Acceso actual
            </p>
            <p class="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              Cliente activo
            </p>
            <p class="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Tu portal esta listo para consultar servicios, reservar y seguir tu historial.
            </p>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Navegacion
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Accesos principales del portal
            </p>
          </div>

          <LayoutSidebarNav :items="navigationItems" />
        </div>
      </aside>

      <div class="flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col lg:min-h-[calc(100vh-5rem)]">
        <main class="flex-1 py-6 pb-10 md:py-8 lg:py-10 lg:pb-24">
          <slot />
        </main>

        <LayoutAppFooter />
      </div>
    </div>

    <USlideover v-if="mobileMenuOpen" :open="mobileMenuOpen" side="left" @update:open="mobileMenuOpen = $event">
      <template #header>
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-sm font-bold text-white">
              NP
            </div>
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
                Portal Cliente
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Navegacion principal
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">
              {{ profile?.full_name || user?.email || "Cliente" }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tu portal personal esta listo para reservar y hacer seguimiento.
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-5 px-1 pb-4">
          <LayoutSidebarNav :items="navigationItems" @navigate="closeMobileMenu" />
        </div>
      </template>
    </USlideover>
  </div>
</template>
