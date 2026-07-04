<script setup lang="ts">
import type { AuthAudience } from "@/types/auth";

const props = withDefaults(defineProps<{
  disabled?: boolean;
  compact?: boolean;
  audience: AuthAudience;
  redirect?: string | null;
  slug?: string | null;
}>(), {
  disabled: false,
  compact: false,
  redirect: null,
  slug: null,
});

const { signInWithProvider, isSubmitting } = useAuth();
const pending = ref(false);

const isDisabled = computed(() => props.disabled || pending.value || isSubmitting.value);

const handleGoogleSignIn = async () => {
  pending.value = true;

  try {
    await signInWithProvider("google", {
      audience: props.audience,
      redirect: props.redirect,
      slug: props.slug,
    });
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <div class="space-y-3">
    <div class="auth-separator">
      <div class="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
      <span class="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        Acceso con Google
      </span>
      <div class="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
    </div>

    <div :class="compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-1'">
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        icon="i-lucide-chrome"
        class="auth-social-button"
        :loading="pending"
        :disabled="isDisabled"
        aria-label="Continuar con Google"
        @click="handleGoogleSignIn"
      >
        Continuar con Google
      </UButton>
    </div>
  </div>
</template>
