<script setup lang="ts">
const props = withDefaults(defineProps<{
  disabled?: boolean;
  compact?: boolean;
}>(), {
  disabled: false,
  compact: false,
});

const providers = [
  {
    label: "Continuar con Google",
    icon: "i-lucide-chrome",
  },
  {
    label: "Continuar con Microsoft",
    icon: "i-lucide-monitor-smartphone",
  },
];
</script>

<template>
  <div class="space-y-3">
    <div class="auth-separator">
      <div class="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
      <span class="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        Accesos sociales
      </span>
      <div class="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
    </div>

    <div :class="compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'">
      <UButton
        v-for="provider in providers"
        :key="provider.label"
        color="neutral"
        variant="soft"
        size="lg"
        :icon="provider.icon"
        class="auth-social-button"
        :disabled="disabled"
        :aria-label="`${provider.label}. Próximamente`"
      >
        {{ provider.label }}
      </UButton>
    </div>

    <p class="text-center text-xs leading-6 text-slate-600 dark:text-slate-300">
      Inicio de sesión social disponible en fase 2.
    </p>
  </div>
</template>
