import type { OrganizationDraft } from "@/types/registration";
import {
  ORGANIZATION_STORAGE_KEY,
  MAX_LOGO_SIZE_BYTES,
  ORGANIZATION_SCHEMA,
  asJsonObject,
} from "@/utils/onboarding";

const createOrganizationDraft = (): OrganizationDraft => ({
  organizationName: "",
  businessType: "hybrid",
  selectedPlan: "emprende",
  billingMode: "monthly",
  country: "BO",
  currency: "BOB",
  timezone: "America/La_Paz",
  logoPreviewUrl: null,
  logoFileName: null,
});

export const useOrganization = () => {
  const { resolveUser } = useSessionAccess();
  const { fetchProfile } = useAuth();

  const draft = useState<OrganizationDraft>(
    "onboarding:organization:draft",
    createOrganizationDraft,
  );
  const loading = useState<boolean>("onboarding:organization:loading", () => false);
  const error = useState<string | null>("onboarding:organization:error", () => null);
  const logoError = useState<string | null>("onboarding:organization:logo-error", () => null);

  const persistDraft = () => {
    if (!import.meta.client) return;
    localStorage.setItem(ORGANIZATION_STORAGE_KEY, JSON.stringify({
      ...draft.value,
      logoPreviewUrl: null,
    }));
  };

  const hydrateDraft = async () => {
    try {
      if (!import.meta.client) return;

      const rawValue = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      if (rawValue) {
        draft.value = { ...createOrganizationDraft(), ...JSON.parse(rawValue) as OrganizationDraft };
      }
    } catch {
      if (import.meta.client) localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
      draft.value = createOrganizationDraft();
    }
  };

  const validateLogoFile = (file: File) => {
    logoError.value = null;
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      logoError.value = "El logo supera el limite de 2MB.";
      throw new Error(logoError.value);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      logoError.value = "El logo debe ser JPG, PNG o WebP.";
      throw new Error(logoError.value);
    }
  };

  const clearLogo = () => {
    logoError.value = null;
    if (draft.value.logoPreviewUrl && import.meta.client) URL.revokeObjectURL(draft.value.logoPreviewUrl);
    draft.value = { ...draft.value, logoPreviewUrl: null, logoFileName: null };
  };

  const createOrganization = async (logoFile: File | null) => {
    loading.value = true;
    error.value = null;

    try {
      const parsed = ORGANIZATION_SCHEMA.parse(draft.value);
      const user = await resolveUser();
      if (!user) throw new Error("Tu sesion no es valida. Inicia sesion nuevamente.");

      const profile = await fetchProfile();
      if (profile?.organization_id) return profile.organization_id;

      const userMetadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
      const metadataFullName = typeof userMetadata.full_name === "string" ? userMetadata.full_name.trim() : "";
      const metadataPhone = typeof userMetadata.phone === "string" ? userMetadata.phone.trim() || null : null;
      const nextFullName = profile?.full_name?.trim() || metadataFullName || "Administrador NexusPOS";
      const nextEmail = profile?.email?.trim() ?? user.email?.trim() ?? "";

      let logoData: { dataBase64: string; name: string; type: string } | null = null;
      if (logoFile) {
        validateLogoFile(logoFile);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
        logoData = { dataBase64: base64, name: logoFile.name, type: logoFile.type };
      }

      const result = await $fetch<{ organizationId: string }>("/api/onboarding/organization", {
        method: "POST",
        body: {
          organizationName: parsed.organizationName,
          businessType: parsed.businessType,
          country: parsed.country,
          currency: parsed.currency,
          timezone: parsed.timezone,
          billingMode: parsed.billingMode,
          fullName: nextFullName,
          email: nextEmail,
          phone: metadataPhone,
          logo: logoData,
        },
      });

      await fetchProfile();

      await $fetch("/api/auth/onboarding-progress", {
        method: "POST",
        body: {
          organizationId: result.organizationId,
          currentStep: "payment",
          progressData: asJsonObject({ organizationId: result.organizationId, organizationDraft: { ...draft.value, logoPreviewUrl: null } }),
        },
      });

      if (import.meta.client) localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
      return result.organizationId;
    } catch (organizationError) {
      const message = organizationError instanceof Error ? organizationError.message : "No se pudo crear la organizacion.";
      if (organizationError instanceof Error && organizationError.message.toLowerCase().includes("logo")) {
        logoError.value = organizationError.message;
      }
      error.value = message;
      throw organizationError;
    } finally {
      loading.value = false;
    }
  };

  if (import.meta.client) {
    onMounted(async () => {
      await hydrateDraft();
    });
  }

  watch(draft, persistDraft, { deep: true });

  return {
    draft,
    loading,
    error,
    logoError,
    hydrateDraft,
    createOrganization,
    clearLogo,
    validateLogoFile,
  };
};
