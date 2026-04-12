<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import LoginForm from "../../components/auth/LoginForm.vue";

definePageMeta({
  layout: false,
  title: "Iniciar sesión",
});

const route = useRoute();

const featureItems = [
  {
    icon: "i-lucide-shield-check",
    title: "Seguridad empresarial",
    description: "Autenticación con RLS, auditoría forense y control estricto por rol.",
  },
  {
    icon: "i-lucide-building-2",
    title: "Multi-sucursal real",
    description: "Administra una o múltiples sedes desde una sola plataforma preparada para crecer.",
  },
  {
    icon: "i-lucide-chart-column-big",
    title: "Operación unificada",
    description: "Ventas, citas e inventario conectados en una misma experiencia operativa.",
  },
] as const;

const getStringQuery = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const redirect = computed(() => {
  const target = getStringQuery(route.query.redirect);
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return null;
  }

  return target;
});

const registered = computed(() => getStringQuery(route.query.registered) === "true");
const sessionExpired = computed(() => getStringQuery(route.query.expired) === "true");
const welcome = computed(() => getStringQuery(route.query.welcome));
</script>

<template>
  <AuthLayout
    eyebrow="Acceso B2B"
    title="La entrada segura a tu operación diaria."
    description="Un flujo de autenticación moderno para equipos que necesitan velocidad, control y una experiencia confiable desde el primer render."
    :feature-items="featureItems"
  >
    <LoginForm
      :redirect="redirect"
      :registered="registered"
      :session-expired="sessionExpired"
      :welcome="welcome"
    />
  </AuthLayout>
</template>
