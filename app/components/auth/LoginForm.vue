<script setup lang="ts">
import { z } from "zod";

import SocialLoginButtons from "./SocialLoginButtons.vue";

type LoginFormData = z.output<typeof schema>;
type LoginSubmitEvent = SubmitEvent & { data: LoginFormData };

const props = withDefaults(defineProps<{
  redirect?: string | null;
  registered?: boolean;
  sessionExpired?: boolean;
  welcome?: string | null;
}>(), {
  redirect: null,
  registered: false,
  sessionExpired: false,
  welcome: null,
});

const schema = z.object({
  email: z.string().email("Ingresa un email valido").min(1, "El email es requerido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  remember: z.boolean().optional(),
});

const REMEMBER_STORAGE_KEY = "nexuspos:auth:remember";

const router = useRouter();
const session = useSupabaseSession();
const { signIn, isLoading, isSubmitting } = useAuth();
const { resolvePostAuthDestination } = useRegistration();
const {
  attemptCount,
  isRateLimited,
  shouldShowWarning,
  shouldShowCaptchaPlaceholder,
  warningMessage,
  rateLimitMessage,
  registerFailure,
  reset: resetRateLimit,
} = useAuthRateLimit();

const state = reactive<LoginFormData>({
  email: "",
  password: "",
  remember: true,
});

const submitting = ref(false);
const redirecting = ref(false);
const error = ref<string | null>(null);
const showPassword = ref(false);
const liveMessage = ref("");

const isBusy = computed(() => submitting.value || redirecting.value || isSubmitting.value || isLoading.value);
const submitDisabled = computed(() => isBusy.value || isRateLimited.value);
const submitLabel = computed(() => {
  if (isRateLimited.value) {
    return "Acceso bloqueado temporalmente";
  }

  if (isBusy.value) {
    return "Validando acceso...";
  }

  return "Iniciar sesion";
});

const sanitizedRedirect = computed(() => {
  if (!props.redirect || !props.redirect.startsWith("/") || props.redirect.startsWith("//")) {
    return null;
  }

  return props.redirect;
});

const secondaryLinksQuery = computed(() => sanitizedRedirect.value ? { redirect: sanitizedRedirect.value } : undefined);
const registrationMessage = computed(() => props.registered ? props.welcome ? `Bienvenido, ${props.welcome}. Tu cuenta fue creada correctamente.` : "Tu cuenta fue creada correctamente. Ya puedes iniciar sesion." : null);
const sessionExpiredMessage = computed(() => props.sessionExpired ? "Tu sesion expiro. Inicia sesion nuevamente para continuar." : null);

const syncRememberPreference = () => {
  if (!import.meta.client) {
    return;
  }

  if (!state.remember) {
    localStorage.removeItem(REMEMBER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(REMEMBER_STORAGE_KEY, JSON.stringify({
    email: state.email.trim().toLowerCase(),
    remember: Boolean(state.remember),
  }));
};

const hydrateRememberPreference = () => {
  if (!import.meta.client) {
    return;
  }

  try {
    const rawValue = localStorage.getItem(REMEMBER_STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    state.email = typeof parsed.email === "string" ? parsed.email : "";
    state.remember = typeof parsed.remember === "boolean" ? parsed.remember : true;
  } catch {
    localStorage.removeItem(REMEMBER_STORAGE_KEY);
  }
};

const redirectByRole = async () => {
  if (redirecting.value) {
    return;
  }

  redirecting.value = true;

  const resolution = await resolvePostAuthDestination();
  try {
    await router.push(sanitizedRedirect.value ?? resolution.destination);
  } finally {
    redirecting.value = false;
  }
};

const togglePassword = () => {
  showPassword.value = !showPassword.value;
};

const handleRateLimit = () => {
  registerFailure();

  if (rateLimitMessage.value) {
    liveMessage.value = rateLimitMessage.value;
    error.value = rateLimitMessage.value;
    return;
  }

  liveMessage.value = warningMessage.value ?? "";
};

const checkExistingSession = async () => {
  if (!session.value?.user || redirecting.value || submitting.value) {
    return;
  }

  await redirectByRole();
};

const onSubmit = async (event: LoginSubmitEvent) => {
  if (isRateLimited.value) {
    error.value = rateLimitMessage.value;
    liveMessage.value = rateLimitMessage.value ?? "";
    return;
  }

  submitting.value = true;
  error.value = null;
  liveMessage.value = "";
  state.email = event.data.email.trim().toLowerCase();

  try {
    const result = await signIn(state.email, event.data.password);

    if (!result.data || result.error) {
      error.value = "Credenciales invalidas.";
      handleRateLimit();
      return;
    }

    syncRememberPreference();
    resetRateLimit();
    await redirectByRole();
  } catch {
    error.value = "Credenciales invalidas.";
    handleRateLimit();
  } finally {
    submitting.value = false;
  }
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== "Escape") {
    return;
  }

  if (showPassword.value) {
    showPassword.value = false;
  } else if (error.value) {
    error.value = null;
  }
};

if (import.meta.client) {
  onMounted(async () => {
    hydrateRememberPreference();
    window.addEventListener("keydown", handleEscape);
    await checkExistingSession();
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleEscape);
  });
}

watch(() => session.value?.user?.id ?? null, async (userId) => {
  if (!userId || redirecting.value || submitting.value) {
    return;
  }

  await checkExistingSession();
});
</script>

<template>
  <UCard class="admin-shell-panel auth-form-card auth-fade-in rounded-[2rem] p-1">
    <div class="rounded-[1.75rem] px-4 py-5 sm:px-7 sm:py-7">
      <div class="mb-6 text-center sm:mb-8">
        <div class="nexus-logo-shell auth-logo-mark mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.75rem] text-lg font-semibold text-white shadow-lg shadow-primary-500/25">
          NP
        </div>
        <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">Acceso seguro</p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Inicia sesion en NexusPOS</h2>
        <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base sm:leading-7">Accede con tu cuenta organizacional para volver a tu flujo de trabajo.</p>
      </div>

      <div class="sr-only" aria-live="polite">{{ liveMessage }}</div>

      <UAlert v-if="registrationMessage" color="success" variant="soft" icon="i-lucide-badge-check" :title="registrationMessage" class="mb-4" />
      <UAlert v-if="sessionExpiredMessage" color="warning" variant="soft" icon="i-lucide-timer-reset" :title="sessionExpiredMessage" class="mb-4" />
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-octagon-alert" :title="error" class="mb-4" />
      <UAlert v-if="shouldShowWarning && warningMessage && !isRateLimited" color="warning" variant="soft" icon="i-lucide-shield-alert" :title="warningMessage" class="auth-pulse-soft mb-4" />

      <UForm :schema="schema" :state="state" :validate-on="['blur']" class="auth-form-stack" @submit="onSubmit">
        <div class="auth-field-group">
          <UFormField class="auth-field" label="Email" name="email">
            <UInput v-model="state.email" type="email" size="xl" autofocus autocomplete="email" placeholder="tu@empresa.com" icon="i-lucide-mail" :disabled="submitDisabled" class="auth-field-input admin-focus-ring w-full" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField class="auth-field" label="Contrasena" name="password">
            <UInput v-model="state.password" :type="showPassword ? 'text' : 'password'" size="xl" autocomplete="current-password" placeholder="Ingresa tu contrasena" icon="i-lucide-lock-keyhole" :disabled="submitDisabled" class="auth-field-input admin-focus-ring w-full" :ui="{ base: 'min-h-11 text-base' }">
              <template #trailing>
                <UButton color="neutral" variant="ghost" size="sm" :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="auth-input-action admin-focus-ring" :aria-label="showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'" :aria-pressed="showPassword" @click.prevent="togglePassword" />
              </template>
            </UInput>
          </UFormField>
        </div>

        <div class="auth-checkbox-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <UCheckbox v-model="state.remember" label="Recordarme en este dispositivo" :disabled="submitDisabled" class="admin-focus-ring" />
          <NuxtLink to="/auth/reset-password" :query="secondaryLinksQuery" class="auth-inline-link admin-focus-ring text-sm font-medium text-primary-700 dark:text-primary-300">
            Olvidaste tu contrasena?
          </NuxtLink>
        </div>

        <div v-if="shouldShowCaptchaPlaceholder" class="auth-helper-panel border-dashed border-amber-300 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
          <p class="font-medium">Verificacion adicional proxima</p>
          <p class="mt-1">El CAPTCHA visual se activara en Fase 2 para reforzar proteccion tras varios intentos fallidos.</p>
          <p class="mt-1 text-xs opacity-80">Intentos registrados: {{ attemptCount }}</p>
        </div>

        <UButton type="submit" block size="xl" class="auth-submit-button admin-focus-ring min-h-11" :loading="isBusy" :disabled="submitDisabled">
          {{ submitLabel }}
        </UButton>
      </UForm>

      <div class="mt-6">
        <SocialLoginButtons :disabled="submitDisabled" compact />
      </div>

      <div class="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <span>Aun no tienes cuenta? </span>
        <NuxtLink to="/auth/register" :query="secondaryLinksQuery" class="auth-inline-link admin-focus-ring font-semibold text-primary-700 dark:text-primary-300">
          Crear cuenta
        </NuxtLink>
      </div>
    </div>
  </UCard>
</template>
