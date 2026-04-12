<script setup lang="ts">
const { signOut } = useAuth();

const emit = defineEmits<{
  support: [];
}>();

const handleLogout = async () => {
  await signOut();
};
</script>

<template>
  <header class="border-b border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
    <UContainer class="flex items-center justify-between gap-4 px-6 py-4">
      <NuxtLink
        to="/system/payment-validations"
        class="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/15 text-primary-700 dark:text-primary-300">
          <span class="text-sm font-bold tracking-[0.18em]">NP</span>
        </div>
        <div>
          <p class="font-semibold text-slate-950 dark:text-white">NexusPOS System</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Revision de pagos de onboarding</p>
        </div>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <UBadge color="primary" variant="soft">
          <UIcon name="i-lucide-shield-check" class="mr-1 h-3.5 w-3.5" />
          Acceso system
        </UBadge>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-life-buoy"
          @click="emit('support')"
        >
          Soporte
        </UButton>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          @click="handleLogout"
        >
          Salir
        </UButton>
      </div>
    </UContainer>
  </header>
</template>
