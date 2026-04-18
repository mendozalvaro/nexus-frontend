<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import OrganizationForm from "../../components/onboarding/OrganizationForm.vue";
import ProgressStepper from "../../components/onboarding/ProgressStepper.vue";

definePageMeta({ layout: false, title: "Configurar empresa" });

const router = useRouter();
const { draft, loading, error, logoError, createOrganization, clearLogo, validateLogoFile, hydrateDraft } = useOrganization();
const { resolvePostAuthDestination, registrationDraft } = useRegistration();
const { detectCountry, loading: geoLoading, error: geoError } = useGeoIP();

const selectedLogo = ref<File | null>(null);

const onDraftUpdate = (value: typeof draft.value) => { draft.value = value; };

const onLogoSelected = (file: File) => {
  try { validateLogoFile(file); } catch { return; }
  selectedLogo.value = file;
  draft.value = { ...draft.value, logoPreviewUrl: import.meta.client ? URL.createObjectURL(file) : null, logoFileName: file.name };
};

const onClearLogo = () => { selectedLogo.value = null; clearLogo(); };

const onSaveLater = async () => { await navigateTo("/dashboard?status=pending", { replace: true }); };

const onSubmit = async () => {
  try {
    const organizationId = await createOrganization(selectedLogo.value);
    if (!organizationId) return;
    await router.push(`/onboarding/payment?plan=${draft.value.selectedPlan}&billing=${draft.value.billingMode}`);
  } catch { /* error handled in composable */ }
};

const featureItems = [
  { icon: "i-lucide-globe", title: "Pais auto-detectado", description: "Detectamos tu pais por IP. Moneda y timezone se ajustan automaticamente." },
  { icon: "i-lucide-credit-card", title: "Plan flexible", description: "Elige plan y facturacion mensual, trimestral o anual con descuento." },
  { icon: "i-lucide-save", title: "Progreso persistente", description: "Guarda y retoma sin perder contexto." },
] as const;

if (import.meta.client) {
  onMounted(async () => {
    await hydrateDraft();
    if (
      registrationDraft.value.selectedPlan &&
      registrationDraft.value.selectedPlan !== draft.value.selectedPlan
    ) {
      draft.value = { ...draft.value, selectedPlan: registrationDraft.value.selectedPlan };
    }
    if (
      registrationDraft.value.billingMode &&
      registrationDraft.value.billingMode !== draft.value.billingMode
    ) {
      draft.value = { ...draft.value, billingMode: registrationDraft.value.billingMode };
    }
    const detected = await detectCountry();
    if (!draft.value.country || draft.value.country === "BO") {
      draft.value = { ...draft.value, country: detected.country, currency: detected.currency, timezone: detected.timezone };
    }
    const resolution = await resolvePostAuthDestination();
    if (resolution.reason !== "organization") await navigateTo(resolution.destination, { replace: true });
  });
}
</script>

<template>
  <AuthLayout eyebrow="Paso 2 de 3" title="Configura tu empresa."
    description="Elige tu plan, tipo de negocio y datos basicos." :feature-items="featureItems" :show-sidebar="false">
    <div class="space-y-5">
      <ProgressStepper current-step="organization" />
      <UAlert v-if="geoError" color="warning" variant="soft" icon="i-lucide-globe" :title="geoError" />
      <OrganizationForm
        :model-value="draft" :loading="loading || geoLoading" :error="error" :logo-error="logoError"
        :geo-country="draft.country" :geo-currency="draft.currency" :geo-timezone="draft.timezone" :geo-loading="geoLoading"
        @update:model-value="onDraftUpdate" @logo-selected="onLogoSelected" @clear-logo="onClearLogo"
        @save-later="onSaveLater" @submit="onSubmit"
      />
    </div>
  </AuthLayout>
</template>
