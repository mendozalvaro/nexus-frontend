<script setup lang="ts">
import { z } from "zod";

import AuthLayout from "../../components/auth/AuthLayout.vue";
import { getDefaultPathForRole } from "../../utils/role-access";

definePageMeta({
  layout: false,
  title: "Recuperar acceso",
});

type ResetFormData = z.output<typeof schema>;
type ResetSubmitEvent = SubmitEvent & { data: ResetFormData };

const schema = z.object({
  email: z.string().trim().email("Ingresa un email válido"),
});

const state = reactive<ResetFormData>({
  email: "",
});

const route = useRoute();
const router = useRouter();
const session = useSupabaseSession();
const { resetPassword, fetchProfile, profile, isSubmitting } = useAuth();

const submitting = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const redirect = computed(() => {
  const target = typeof route.query.redirect === "string" ? route.query.redirect : null;
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return null;
  }

  return target;
});

const authLinkQuery = computed(() => redirect.value ? { redirect: redirect.value } : undefined);

const featureItems = [
  {
    icon: "i-lucide-key-round",
    title: "Recuperación segura",
    description: "Solicita un enlace seguro sin revelar si el correo existe en nuestra base.",
  },
  {
    icon: "i-lucide-mail-check",
    title: "Flujo guiado",
    description: "Mensajes claros, feedback inmediato y continuidad hacia tu destino original.",
  },
  {
    icon: "i-lucide-lock",
    title: "Protección consistente",
    description: "El proceso mantiene las mismas reglas de seguridad que el resto del sistema.",
  },
] as const;

const goToDestination = async () => {
  const currentProfile = profile.value ?? (await fetchProfile());
  await router.replace(getDefaultPathForRole(currentProfile?.role));
};

/**
 * Solicita el email de recuperación con un mensaje neutral para no filtrar cuentas existentes.
 */
const onSubmit = async (event: ResetSubmitEvent) => {
  submitting.value = true;
  error.value = null;
  successMessage.value = null;

  try {
    const result = await resetPassword(event.data.email.trim().toLowerCase());

    if (result.error) {
      error.value = "No se pudo procesar la solicitud. Intenta nuevamente.";
      return;
    }

    successMessage.value = "Si el correo pertenece a una cuenta válida, recibirás instrucciones para restablecer tu contraseña.";
  } catch {
    error.value = "No se pudo procesar la solicitud. Intenta nuevamente.";
  } finally {
    submitting.value = false;
  }
};

if (import.meta.client) {
  onMounted(async () => {
    if (session.value?.user) {
      await goToDestination();
    }
  });
}
</script>

<template>
  <AuthLayout
    eyebrow="Recuperación"
    title="Vuelve a entrar sin fricción ni fugas de información."
    description="Diseñamos la recuperación de acceso para que sea clara para el usuario y opaca para actores maliciosos."
    :feature-items="featureItems"
  >
    <UCard class="admin-shell-panel auth-form-card auth-fade-in rounded-[2rem] p-1">
      <div class="rounded-[1.75rem] px-4 py-5 sm:px-7 sm:py-7">
        <div class="mb-8 text-center">
          <div class="nexus-logo-shell auth-logo-mark mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.75rem] text-lg font-semibold text-white shadow-lg shadow-primary-500/25">
            NP
          </div>
          <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">
            Recuperación segura
          </p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Restablece tu contraseña
          </h1>
          <p class="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Te enviaremos un enlace seguro al correo asociado a tu cuenta.
          </p>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-octagon-alert"
          :title="error"
          class="mb-4"
        />
        <UAlert
          v-if="successMessage"
          color="success"
          variant="soft"
          icon="i-lucide-badge-check"
          :title="successMessage"
          class="mb-4"
        />

        <UForm :schema="schema" :state="state" :validate-on="['blur']" class="auth-form-stack" @submit="onSubmit">
          <div class="auth-field-group">
          <UFormField class="auth-field" label="Email" name="email" description="Usa el mismo correo con el que accedes a tu organizaciÃ³n.">
            <UInput
              v-model="state.email"
              type="email"
              size="xl"
              autocomplete="email"
              autofocus
              placeholder="tu@empresa.com"
              icon="i-lucide-mail"
              :disabled="submitting || isSubmitting"
              class="auth-field-input admin-focus-ring"
              aria-label="Correo electrónico"
            />
          </UFormField>
          </div>

          <UButton
            type="submit"
            block
            size="xl"
            class="auth-submit-button admin-focus-ring"
            :loading="submitting || isSubmitting"
            :disabled="submitting || isSubmitting"
          >
            {{ submitting || isSubmitting ? "Enviando instrucciones..." : "Enviar instrucciones" }}
          </UButton>
        </UForm>

        <div class="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
          <span>Recordaste tu acceso? </span>
          <NuxtLink
            to="/auth/login"
            :query="authLinkQuery"
            class="auth-inline-link admin-focus-ring font-semibold text-primary-700 dark:text-primary-300"
          >
            Volver al login
          </NuxtLink>
        </div>
      </div>
    </UCard>
  </AuthLayout>
</template>
