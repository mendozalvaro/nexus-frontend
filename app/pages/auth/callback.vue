<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import { sanitizeAuthAudience, sanitizeStorefrontSlug } from "@/utils/auth";
import { buildLoginRedirectPath, sanitizeInternalRedirect } from "@/utils/redirect";

definePageMeta({
  layout: false,
  title: "Procesando acceso",
  middleware: [],
});

const router = useRouter();
const route = useRoute();
const { waitForAuthenticatedUser } = useSessionAccess();
const { resolvePostAuthDestination } = usePostAuthResolution();

const statusMessage = ref("Validando autenticacion...");
const errorMessage = ref<string | null>(null);

const featureItems = [
  {
    icon: "i-lucide-shield-check",
    title: "Validacion segura",
    description: "Verificamos tu sesion antes de resolver permisos y navegacion.",
  },
  {
    icon: "i-lucide-arrow-right-left",
    title: "Redireccion correcta",
    description: "Respetamos el destino original cuando el parametro `redirect` es valido.",
  },
  {
    icon: "i-lucide-mail-check",
    title: "Callback unificado",
    description: "El mismo callback soporta confirmacion de email, recuperacion y OAuth por audiencia.",
  },
] as const;

const redirectParam = computed(() => {
  const raw = route.query.redirect;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
});

const audience = computed(() => sanitizeAuthAudience(route.query.audience));
const storefrontSlug = computed(() => sanitizeStorefrontSlug(route.query.slug));
const fallbackPath = computed(() => {
  if (audience.value === "client") {
    return sanitizeInternalRedirect(redirectParam.value) ?? (storefrontSlug.value ? `/${storefrontSlug.value}` : "/");
  }

  return buildLoginRedirectPath(redirectParam.value ?? "");
});
const fallbackLabel = computed(() => audience.value === "client" ? "Volver a la tienda" : "Volver al login");

const resolveAndRedirect = async (user: Awaited<ReturnType<typeof waitForAuthenticatedUser>>) => {
  try {
    const resolution = await resolvePostAuthDestination({
      audience: audience.value,
      redirect: redirectParam.value,
      slug: storefrontSlug.value,
      user,
    });

    if (resolution.reason === "unauthorized") {
      statusMessage.value = "Acceso rechazado para este flujo.";
      errorMessage.value = resolution.errorMessage ?? "No pudimos completar la autenticacion.";
      return;
    }

    statusMessage.value = "Redirigiendo...";
    await router.replace(resolution.destination);
  } catch {
    errorMessage.value = "No pudimos completar la autenticacion. Intenta nuevamente.";
  }
};

onMounted(async () => {
  const user = await waitForAuthenticatedUser({
    attempts: 10,
    delayMs: 1000,
  });

  if (!user) {
    await navigateTo(fallbackPath.value, { replace: true });
    return;
  }

  await resolveAndRedirect(user);
});
</script>

<template>
  <AuthLayout
    eyebrow="Callback seguro"
    title="Estamos cerrando tu autenticacion."
    description="Unificamos confirmacion de email, recuperacion y accesos OAuth dentro del mismo flujo controlado."
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
          <NuxtLink :to="fallbackPath" class="auth-inline-link admin-focus-ring font-semibold text-primary-700 dark:text-primary-300">
            {{ fallbackLabel }}
          </NuxtLink>
        </div>
      </div>
    </UCard>
  </AuthLayout>
</template>
