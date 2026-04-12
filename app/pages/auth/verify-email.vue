<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import EmailVerification from "../../components/auth/EmailVerification.vue";
import ProgressStepper from "../../components/onboarding/ProgressStepper.vue";

definePageMeta({
  layout: false,
  title: "Verificar email",
});

const route = useRoute();
const router = useRouter();
const session = useSupabaseSession();
const {
  registrationDraft,
  canResendIn,
  verifying,
  error,
  resendVerificationEmail,
  refreshVerificationStatus,
  resolvePostAuthDestination,
} = useRegistration();

const email = computed(() => typeof route.query.email === "string" ? route.query.email : registrationDraft.value.email);
const verified = ref(false);
const alreadyVerifiedElsewhere = ref(false);

const redirectIfVerified = async () => {
  const resolution = await resolvePostAuthDestination();
  if (resolution.reason === "verify") {
    return;
  }

  verified.value = true;
  alreadyVerifiedElsewhere.value = true;
  await navigateTo(resolution.destination, { replace: true });
};

const checkStatus = async () => {
  if (!session.value?.user) {
    return;
  }

  const user = await refreshVerificationStatus();
  if (user?.email_confirmed_at) {
    await redirectIfVerified();
  }
};

const onResend = async () => {
  await resendVerificationEmail(email.value);
};

if (import.meta.client) {
  onMounted(async () => {
    await checkStatus();

    const interval = window.setInterval(checkStatus, 5000);
    const listener = async () => await checkStatus();
    document.addEventListener("visibilitychange", listener);

    onBeforeUnmount(() => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", listener);
    });
  });
}

watch(() => session.value?.user?.email_confirmed_at ?? null, async (value, previousValue) => {
  if (!value || value === previousValue) {
    return;
  }

  await redirectIfVerified();
});

const featureItems = [
  {
    icon: "i-lucide-mail-check",
    title: "Verificacion activa",
    description: "Consultamos el estado para evitar que te quedes atascado despues de confirmar.",
  },
  {
    icon: "i-lucide-clock-3",
    title: "Reenvio con espera",
    description: "Limitamos el reenvio a una vez por minuto para reducir abuso y spam.",
  },
  {
    icon: "i-lucide-arrow-right",
    title: "Continuidad del flujo",
    description: "Cuando el email se confirme, te llevaremos al siguiente paso automaticamente.",
  },
] as const;
</script>

<template>
  <AuthLayout
    eyebrow="Verificacion"
    title="Confirma tu correo para continuar."
    description="Este paso protege el acceso inicial y habilita la configuracion de tu organizacion."
    :feature-items="featureItems"
  >
    <div class="space-y-5">
      <ProgressStepper current-step="verification" />
      <EmailVerification
        :email="email"
        :checking="verifying"
        :verified="verified"
        :resend-cooldown="canResendIn"
        :already-verified-elsewhere="alreadyVerifiedElsewhere"
        :error="error"
        @resend="onResend"
        @change-email="router.push('/auth/register')"
      />
    </div>
  </AuthLayout>
</template>
