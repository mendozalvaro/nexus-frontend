<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";


definePageMeta({
  layout: false,
  title: "Procesando acceso",
});

const session = useSupabaseSession();
const route = useRoute();
const { resolvePostAuthDestination } = useRegistration();

const statusMessage = ref("Validando autenticación...");
const errorMessage = ref<string | null>(null);

const featureItems = [
  {
    icon: "i-lucide-shield-check",
    title: "Validación segura",
    description: "Verificamos tu sesión antes de resolver permisos y navegación.",
  },
  {
    icon: "i-lucide-arrow-right-left",
    title: "Redirección correcta",
    description: "Respetamos el destino original cuando el parámetro `redirect` es válido.",
  },
  {
    icon: "i-lucide-mail-check",
    title: "Confirmación centralizada",
    description: "El mismo callback soporta confirmación de email y futuros proveedores OAuth.",
  },
] as const;

const sanitizeRedirect = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
};

const handleCallback = async () => {
  try {
    if (!session.value?.user) {
      statusMessage.value = "Finalizando verificación...";
      await navigateTo("/auth/login", { replace: true });
      return;
    }

    const resolution = await resolvePostAuthDestination();
    const redirectTarget = sanitizeRedirect(route.query.redirect) ?? resolution.destination;

    statusMessage.value = "Redirigiendo a tu espacio...";
    await navigateTo(redirectTarget, { replace: true });
  } catch {
    errorMessage.value = "No pudimos completar la autenticación. Intenta nuevamente.";
  }
};

await useAsyncData("auth-callback-handler", handleCallback);
</script>

<template>
  <AuthLayout
    eyebrow="Callback seguro"
    title="Estamos cerrando tu autenticación."
    description="Unificamos confirmación de email, recuperación y futuros accesos OAuth dentro del mismo flujo controlado."
    :feature-items="featureItems"
  >
    <UCard class="admin-shell-panel auth-form-card auth-fade-in rounded-[2rem] p-1">
      <div class="rounded-[1.75rem] px-4 py-8 text-center sm:px-7">
        <UIcon
          name="i-lucide-loader-circle"
          class="mx-auto mb-4 h-10 w-10 animate-spin text-primary-500"
        />
        <h1 class="text-2xl font-semibold text-slate-950 dark:text-white">Procesando acceso</h1>
        <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{{ statusMessage }}</p>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-octagon-alert"
          :title="errorMessage"
          class="mt-6"
        />

        <div class="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
          <NuxtLink to="/auth/login" class="auth-inline-link admin-focus-ring font-semibold text-primary-700 dark:text-primary-300">
            Volver al login
          </NuxtLink>
        </div>
      </div>
    </UCard>
  </AuthLayout>
</template>
