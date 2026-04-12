<script setup lang="ts">
import AuthLayout from "../../components/auth/AuthLayout.vue";
import OrganizationForm from "../../components/onboarding/OrganizationForm.vue";
import ProgressStepper from "../../components/onboarding/ProgressStepper.vue";

definePageMeta({
  layout: false,
  title: "Configurar organizacion",
});

const router = useRouter();
const { draft, loading, slugChecking, error, logoError, validateSlug, saveDraftToProgress, createOrganization, clearLogo, validateLogoFile } = useOrganization();
const { resolvePostAuthDestination } = useRegistration();

const selectedLogo = ref<File | null>(null);
const slugAvailable = ref<boolean | null>(null);
const slugSuggestions = ref<string[]>([]);
let slugTimeout: ReturnType<typeof setTimeout> | null = null;

const onDraftUpdate = (value: typeof draft.value) => {
  draft.value = value;

  if (slugTimeout) {
    clearTimeout(slugTimeout);
  }

  slugTimeout = setTimeout(async () => {
    if (!draft.value.slug) {
      slugAvailable.value = null;
      slugSuggestions.value = [];
      return;
    }

    const result = await validateSlug(draft.value.slug);
    draft.value.slug = result.normalizedSlug;
    slugAvailable.value = result.available;
    slugSuggestions.value = result.suggestions;
  }, 300);
};

const onLogoSelected = (file: File) => {
  try {
    validateLogoFile(file);
  } catch {
    return;
  }

  selectedLogo.value = file;

  if (draft.value.logoPreviewUrl && import.meta.client) {
    URL.revokeObjectURL(draft.value.logoPreviewUrl);
  }

  draft.value = {
    ...draft.value,
    logoPreviewUrl: import.meta.client ? URL.createObjectURL(file) : null,
    logoFileName: file.name,
  };
};

const onClearLogo = () => {
  selectedLogo.value = null;
  clearLogo();
};

const onSaveLater = async () => {
  await saveDraftToProgress();
  await navigateTo("/dashboard?status=pending", { replace: true });
};

const onSubmit = async () => {
  try {
    const organizationId = await createOrganization(selectedLogo.value);
    if (!organizationId) {
      return;
    }

    await router.push("/onboarding/payment");
  } catch {
    // El composable ya centraliza el mensaje de error visible.
  }
};

const featureItems = [
  {
    icon: "i-lucide-building-2",
    title: "Tenant listo",
    description: "Configuramos tu empresa con datos consistentes para timezone, moneda y facturacion.",
  },
  {
    icon: "i-lucide-scan-search",
    title: "Slug en tiempo real",
    description: "Validamos disponibilidad y proponemos alternativas cuando un nombre ya existe.",
  },
  {
    icon: "i-lucide-save",
    title: "Progreso persistente",
    description: "Puedes guardar y retomar desde donde te quedaste sin perder contexto.",
  },
] as const;

if (import.meta.client) {
  onMounted(async () => {
    const resolution = await resolvePostAuthDestination();
    if (resolution.reason !== "organization") {
      await navigateTo(resolution.destination, { replace: true });
    }
  });
}
</script>

<template>
  <AuthLayout
    eyebrow="Onboarding"
    title="Configura tu organizacion."
    description="Estos datos alimentan la experiencia inicial, la facturacion y el contexto operativo de NexusPOS."
    :feature-items="featureItems"
  >
    <div class="space-y-5">
      <ProgressStepper current-step="organization" />
      <OrganizationForm
        :model-value="draft"
        :loading="loading"
        :slug-checking="slugChecking"
        :slug-available="slugAvailable"
        :slug-suggestions="slugSuggestions"
        :error="error"
        :logo-error="logoError"
        @update:model-value="onDraftUpdate"
        @logo-selected="onLogoSelected"
        @clear-logo="onClearLogo"
        @save-later="onSaveLater"
        @submit="onSubmit"
      />
    </div>
  </AuthLayout>
</template>
