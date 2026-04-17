<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

interface AuthFeature {
  icon: string;
  title: string;
  description: string;
}

const props = withDefaults(defineProps<{
  eyebrow: string;
  title: string;
  description: string;
  featureItems?: readonly AuthFeature[];
  showSidebar?: boolean;
}>(), {
  featureItems: () => [],
  showSidebar: true,
});

const colorMode = useColorMode();
const hasMounted = ref(false);

const resolvedTheme = computed(() => hasMounted.value ? colorMode.value : "system");
const themeIcon = computed(() => {
  if (!hasMounted.value) {
    return undefined;
  }

  return resolvedTheme.value === "dark" ? "i-lucide-sun-medium" : "i-lucide-moon-star";
});
const themeLabel = computed(() => {
  if (!hasMounted.value) {
    return "Cambiar tema";
  }

  return resolvedTheme.value === "dark" ? "Activar tema claro" : "Activar tema oscuro";
});

const toggleTheme = () => {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
};

onMounted(() => {
  hasMounted.value = true;
});
</script>

<template>
  <div class="auth-shell relative min-h-screen overflow-hidden text-slate-950 dark:text-white">
    <div class="auth-gradient-orb auth-gradient-orb-left" aria-hidden="true" />
    <div class="auth-gradient-orb auth-gradient-orb-right" aria-hidden="true" />
    <div class="auth-grid-overlay" aria-hidden="true" />

    <div class="relative z-10 flex min-h-screen flex-col">
      <header class="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div class="mx-auto flex w-full max-w-7xl items-center justify-between">
          <NuxtLink to="/auth/login" class="admin-focus-ring admin-interactive flex items-center gap-3 rounded-2xl">
            <div class="nexus-logo-shell auth-logo-mark flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-lg">
              NP
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-950 dark:text-white">NexusPOS</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">Plataforma SaaS B2B</p>
            </div>
          </NuxtLink>

          <UButton
            color="neutral"
            variant="ghost"
            :icon="themeIcon"
            class="admin-focus-ring admin-interactive rounded-2xl"
            :aria-label="themeLabel"
            @click="toggleTheme"
          />
        </div>
      </header>

      <div
        class="mx-auto flex w-full flex-1 flex-col px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10"
        :class="showSidebar ? 'max-w-7xl lg:flex-row lg:items-center lg:gap-10' : 'max-w-2xl'"
      >
        <aside v-if="showSidebar" class="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:py-8">
          <div class="max-w-xl">
            <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">
              {{ eyebrow }}
            </p>
            <h1 class="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white xl:text-5xl">
              {{ title }}
            </h1>
            <p class="mt-5 max-w-xl text-base leading-8 text-slate-700 dark:text-slate-200">
              {{ description }}
            </p>
          </div>

          <div class="grid gap-4 xl:grid-cols-3">
            <article
              v-for="feature in featureItems"
              :key="feature.title"
              class="admin-shell-panel auth-float-in rounded-[1.75rem] p-5"
            >
              <div class="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
                <UIcon :name="feature.icon" class="h-5 w-5" />
              </div>
              <h2 class="text-base font-semibold text-slate-950 dark:text-white">
                {{ feature.title }}
              </h2>
              <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {{ feature.description }}
              </p>
            </article>
          </div>
        </aside>

        <main id="auth-main" class="flex flex-1 items-center justify-center py-4 lg:py-8">
          <div class="w-full max-w-xl">
            <slot />

            <div v-if="showSidebar && featureItems.length" class="mt-6 grid gap-3 lg:hidden">
              <article
                v-for="feature in featureItems"
                :key="feature.title"
                class="admin-shell-panel rounded-[1.5rem] p-4"
              >
                <div class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
                  <UIcon :name="feature.icon" class="h-5 w-5" />
                </div>
                <h2 class="text-base font-semibold text-slate-950 dark:text-white">
                  {{ feature.title }}
                </h2>
                <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {{ feature.description }}
                </p>
              </article>
            </div>

            <footer class="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
              <NuxtLink to="/terms" class="auth-inline-link admin-focus-ring">T&eacute;rminos</NuxtLink>
              <NuxtLink to="/privacy" class="auth-inline-link admin-focus-ring">Privacidad</NuxtLink>
              <a href="mailto:soporte@nexuspos.app" class="auth-inline-link admin-focus-ring">Soporte</a>
            </footer>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
