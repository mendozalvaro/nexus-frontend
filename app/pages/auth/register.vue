<script setup lang="ts">
import type { BillingMode } from "@/types/registration";
import AuthLayout from "../../components/auth/AuthLayout.vue";
import RegisterForm from "../../components/auth/RegisterForm.vue";
import ProgressStepper from "../../components/onboarding/ProgressStepper.vue";

definePageMeta({ layout: false, title: "Crear cuenta" });

const session = useSupabaseSession();
const router = useRouter();
const route = useRoute();
const { registrationDraft, loading, error, registerUser, resolvePostAuthDestination } = useRegistration();

const featureItems = [
  { icon: "i-lucide-users", title: "Onboarding guiado", description: "Cada paso deja progreso guardado." },
  { icon: "i-lucide-shield", title: "Seguro", description: "Email verificado para proteger tu acceso." },
  { icon: "i-lucide-building-2", title: "Tu negocio", description: "Configura tu empresa despues de verificar tu email." },
] as const;

const onSubmit = async () => {
  try {
    const result = await registerUser(registrationDraft.value);
    await router.push({ path: "/auth/verify-email", query: { email: result.email } });
  } catch { return; }
};

if (import.meta.client) {
  onMounted(() => {
    const planParam = typeof route.query.plan === "string" ? route.query.plan : null;
    const billingParam = typeof route.query.billing === "string" ? route.query.billing : null;
    const validPlans = ["emprende", "crecimiento", "enterprise"] as const;
    const validBilling: BillingMode[] = ["monthly", "annual"];

    registrationDraft.value = {
      ...registrationDraft.value,
      selectedPlan: planParam && validPlans.includes(planParam as any)
        ? (planParam as typeof registrationDraft.value.selectedPlan)
        : registrationDraft.value.selectedPlan,
      billingMode: billingParam && validBilling.includes(billingParam as BillingMode)
        ? (billingParam as BillingMode)
        : registrationDraft.value.billingMode,
    };
  });

  onMounted(async () => {
    if (!session.value?.user) return;
    const resolution = await resolvePostAuthDestination();
    await navigateTo(resolution.destination, { replace: true });
  });
}
</script>

<template>
  <AuthLayout eyebrow="Registro SaaS" title="Empieza con una cuenta lista para crecer."
    description="Crea tu acceso, verifica tu email y configura tu empresa." :feature-items="featureItems" :show-sidebar="false">
    <div class="space-y-5">
      <ProgressStepper current-step="registration" />
      <RegisterForm v-model="registrationDraft" :loading="loading" :error="error" @submit="onSubmit" />
    </div>
  </AuthLayout>
</template>
