<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import RegisterForm from "../../components/auth/RegisterForm.vue";
import ProgressStepper from "../../components/onboarding/ProgressStepper.vue";

definePageMeta({
  layout: false,
  title: "Crear cuenta",
});

const session = useSupabaseSession();
const router = useRouter();
const {
  registrationDraft,
  loading,
  error,
  registerUser,
  resolvePostAuthDestination,
} = useRegistration();

const featureItems = [
  {
    icon: "i-lucide-users",
    title: "Onboarding guiado",
    description: "Cada paso deja progreso guardado para retomar sin friccion.",
  },
  {
    icon: "i-lucide-shield",
    title: "Mensajes seguros",
    description: "El email usa respuestas genericas para no exponer cuentas registradas.",
  },
  {
    icon: "i-lucide-building-2",
    title: "Preparado para tu negocio",
    description: "Despues de verificar tu email podras configurar organizacion y pago manual.",
  },
] as const;

const onSubmit = async () => {
  try {
    const result = await registerUser(registrationDraft.value);
    await router.push({
      path: "/auth/verify-email",
      query: {
        email: result.email,
      },
    });
  } catch {
    return;
  }
};

if (import.meta.client) {
  onMounted(async () => {
    if (!session.value?.user) {
      return;
    }

    const resolution = await resolvePostAuthDestination();
    await navigateTo(resolution.destination, { replace: true });
  });
}
</script>

<template>
  <AuthLayout eyebrow="Registro SaaS" title="Empieza con una cuenta lista para crecer."
    description="Crea tu acceso inicial, verifica tu email y continua el onboarding de organizacion y pago manual sin perder progreso."
    :feature-items="featureItems">
    <div class="space-y-5">
      <ProgressStepper current-step="registration" />
      <RegisterForm v-model="registrationDraft" :loading="loading" :error="error" @submit="onSubmit" />
    </div>
  </AuthLayout>
</template>
