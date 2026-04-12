<script setup lang="ts">
const currentYear = computed(() => new Date().getFullYear());
const appVersion = "v1.0.0";
</script>

<template>
  <footer class="sticky bottom-0 left-0 right-0 z-30 w-full border-t border-slate-200/70 bg-white/94 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/90 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div class="space-y-0.5">
        <p class="text-sm font-semibold text-slate-900 dark:text-white">
          NexusPOS
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          &copy; {{ currentYear }} Plataforma operativa multi-tenant.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <NuxtLink to="/terms" class="rounded-full border border-slate-200 px-3 py-1 transition hover:border-sky-200 hover:text-sky-700 dark:border-slate-800 dark:hover:border-sky-800 dark:hover:text-sky-300">
          Terminos
        </NuxtLink>
        <NuxtLink to="/privacy" class="rounded-full border border-slate-200 px-3 py-1 transition hover:border-sky-200 hover:text-sky-700 dark:border-slate-800 dark:hover:border-sky-800 dark:hover:text-sky-300">
          Privacidad
        </NuxtLink>
        <a href="mailto:soporte@nexuspos.app" class="rounded-full border border-slate-200 px-3 py-1 transition hover:border-sky-200 hover:text-sky-700 dark:border-slate-800 dark:hover:border-sky-800 dark:hover:text-sky-300">
          Soporte
        </a>
        <span class="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {{ appVersion }}
        </span>
      </div>
    </div>
  </footer>
</template>
