<script setup lang="ts">
const props = defineProps<{
  email: string;
  checking?: boolean;
  verified?: boolean;
  resendCooldown: number;
  alreadyVerifiedElsewhere?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  resend: [];
  "change-email": [];
}>();
</script>

<template>
  <UCard class="admin-shell-panel auth-form-card auth-fade-in rounded-[2rem] p-1">
    <div class="rounded-[1.75rem] px-4 py-6 sm:px-7 sm:py-7">
      <div class="mb-6 text-center">
        <div class="mx-auto flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
          <UIcon :name="verified ? 'i-lucide-badge-check' : checking ? 'i-lucide-loader-circle' : 'i-lucide-mail-check'" class="h-9 w-9" :class="checking ? 'animate-spin' : ''" />
        </div>
        <h2 class="mt-4 text-3xl font-semibold text-slate-950 dark:text-white">
          {{ verified ? "Email verificado" : checking ? "Verificando..." : "Revisa tu correo" }}
        </h2>
        <p class="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Enviamos el enlace a <span class="font-semibold text-slate-950 dark:text-white">{{ email }}</span>. Revisa tu bandeja de entrada y spam.
        </p>
      </div>

      <div class="space-y-4">
        <UAlert
          v-if="alreadyVerifiedElsewhere"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          title="Detectamos la verificacion en otra pestana"
          description="Te redirigiremos automaticamente al siguiente paso."
        />

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :title="error"
        />

        <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p class="text-sm font-semibold text-slate-950 dark:text-white">Estado actual</p>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {{ verified ? "Tu email ya fue confirmado. Estamos preparando el onboarding." : checking ? "Consultando el estado de tu cuenta..." : "Email enviado. Te avisaremos cuando se confirme." }}
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <UButton color="neutral" variant="soft" :disabled="resendCooldown > 0 || checking" class="sm:flex-1" @click="emit('resend')">
            {{ resendCooldown > 0 ? `Reenviar disponible en ${resendCooldown}s` : "Reenviar email" }}
          </UButton>
          <UButton color="neutral" variant="ghost" class="sm:flex-1" @click="emit('change-email')">
            Cambiar email
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
