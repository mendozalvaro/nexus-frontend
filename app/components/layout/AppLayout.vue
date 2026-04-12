<script setup lang="ts">
import type { User } from "@supabase/supabase-js";

import AppAside from "./AppAside.vue";
import AppFooter from "./AppFooter.vue";
import AppHeader from "./AppHeader.vue";
import type { NavigationItem } from "../../composables/useNavigation";
import type { Profile } from "../../types/auth";
import type { Database } from "../../types/database.types";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];

const props = withDefaults(
  defineProps<{
    title: string;
    homePath: string;
    profilePath: string;
    settingsPath: string;
    loadingMessage: string;
    items: NavigationItem[];
    user?: User | null;
    profile?: Profile | null;
    organization?: Organization | null;
    showBreadcrumbs?: boolean;
    showNotifications?: boolean;
    simplifiedHeader?: boolean;
    isLoading?: boolean;
  }>(),
  {
    user: null,
    profile: null,
    organization: null,
    showBreadcrumbs: true,
    showNotifications: true,
    simplifiedHeader: false,
    isLoading: false,
  },
);

const emit = defineEmits<{
  logout: [];
}>();

const isSidebarOpen = ref(false);

const closeSidebar = () => {
  isSidebarOpen.value = false;
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
    closeSidebar();
  }
}
</script>

<template>
  <div class="nexus-app-shell min-h-screen text-slate-950 transition-colors duration-200 dark:text-slate-50">
    <AppAside
      :items="items"
      :title="title"
      :collapsed="isSidebarOpen"
      @close="closeSidebar"
    />

    <div class="min-h-screen lg:pl-80">
      <AppHeader
        :user="user"
        :profile="profile"
        :organization="organization"
        :home-path="homePath"
        :profile-path="profilePath"
        :settings-path="settingsPath"
        :show-breadcrumbs="showBreadcrumbs"
        :show-notifications="showNotifications"
        :simplified="simplifiedHeader"
        :is-loading="isLoading"
        @menu="isSidebarOpen = true"
        @logout="emit('logout')"
      />

      <main class="p-4 sm:p-6 lg:p-8">
        <div
          v-if="isLoading && !profile"
          class="admin-shell-panel-muted flex min-h-[60vh] items-center justify-center rounded-[2rem] border-dashed px-6 text-center"
        >
          <div>
            <UIcon name="i-lucide-loader-circle" class="mx-auto mb-3 h-8 w-8 animate-spin text-primary-500" />
            <p class="text-sm text-slate-600 dark:text-slate-300">{{ loadingMessage }}</p>
          </div>
        </div>

        <div
          v-else
          class="admin-shell-panel overflow-hidden rounded-[2rem] transition-colors duration-200"
        >
          <div class="min-h-[calc(100vh-12rem)] p-4 sm:p-6 lg:p-8">
            <slot />
          </div>

          <AppFooter />
        </div>
      </main>
    </div>
  </div>
</template>
