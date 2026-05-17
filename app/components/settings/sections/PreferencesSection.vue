<script setup lang="ts">
import type { AppTheme } from "@/composables/useTheme";

const { theme, setTheme } = useTheme();

const themeOptions = [
  { value: "light" as AppTheme, label: "Claro", icon: "i-lucide-sun" },
  { value: "dark" as AppTheme, label: "Oscuro", icon: "i-lucide-moon" },
  { value: "system" as AppTheme, label: "Sistema", icon: "i-lucide-monitor" },
];

const STORAGE_KEY = "nexuspos:settings:notifications";

const loadNotificationState = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? JSON.parse(stored) : false;
  } catch {
    return false;
  }
};

const notificationEnabled = ref(loadNotificationState());

watch(notificationEnabled, (val) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  } catch {
    // Storage full or disabled
  }
});
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <!-- Apariencia -->
    <div class="rounded-2xl border border-slate-200 p-6 dark:border-slate-700">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Apariencia</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Elige como se ve tu interfaz.</p>
      </div>
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            class="flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition"
            :class="theme === opt.value
              ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-950/30 dark:text-primary-300'
              : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'"
            @click="setTheme(opt.value)"
          >
            <UIcon :name="opt.icon" class="h-6 w-6" />
            {{ opt.label }}
          </button>
        </div>

        <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Vista previa</p>
          <div class="mt-3 space-y-2">
            <div class="flex gap-2">
              <div class="h-3 w-3 rounded-full bg-red-400" />
              <div class="h-3 w-3 rounded-full bg-amber-400" />
              <div class="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <div class="h-2 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div class="h-2 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            <div class="h-2 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div class="mt-3 h-8 w-full rounded-lg bg-primary-500/20 ring-1 ring-primary-500/30" />
          </div>
        </div>
      </div>
    </div>

    <!-- Notificaciones -->
    <div class="rounded-2xl border border-slate-200 p-6 dark:border-slate-700">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Notificaciones</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Configura como recibes alertas del sistema.</p>
      </div>
      <div class="space-y-4">
        <div class="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div>
            <p class="font-medium text-slate-900 dark:text-white">Notificaciones por email</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">Recibe alertas de citas, ventas y stock bajo.</p>
          </div>
          <USwitch v-model="notificationEnabled" />
        </div>

        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div class="flex gap-3">
            <UIcon name="i-lucide-info" class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Proximamente</p>
              <p class="mt-1 text-sm text-amber-700 dark:text-amber-400">
                Notificaciones avanzadas (push, SMS, webhooks) en una proxima actualizacion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
