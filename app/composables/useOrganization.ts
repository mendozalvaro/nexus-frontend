import type { Database } from "@/types/database.types";
import type { OrganizationDraft } from "@/types/registration";
import {
  ORGANIZATION_STORAGE_KEY,
  MAX_LOGO_SIZE_BYTES,
  buildOrganizationLogoStoragePath,
  sanitizeText,
  sanitizeNullableText,
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
  const supabase = useSupabaseClient<Database>();
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
      if (!import.meta.client) {
        return;
      }

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

  const uploadLogo = async (userId: string, organizationId: string, file: File): Promise<string | null> => {
    validateLogoFile(file);
    const storagePath = buildOrganizationLogoStoragePath(userId, organizationId, file.type);

    const { error: uploadError } = await supabase.storage
      .from("organization-assets")
      .upload(storagePath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("organization-assets").getPublicUrl(storagePath);
    return data.publicUrl;
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
      const metadataFullName = typeof userMetadata.full_name === "string" ? sanitizeText(userMetadata.full_name) : "";
      const metadataPhone = typeof userMetadata.phone === "string" ? sanitizeNullableText(userMetadata.phone) : null;
      const nextFullName = sanitizeText(profile?.full_name || metadataFullName) || "Administrador NexusPOS";
      const nextEmail = sanitizeText(profile?.email ?? user.email ?? "");

      const { data: organizationId, error: createError } = await supabase.rpc(
        "create_onboarding_organization",
        {
          p_name: sanitizeText(parsed.organizationName),
          p_business_type: parsed.businessType,
          p_country: parsed.country,
          p_currency: parsed.currency,
          p_timezone: parsed.timezone,
          p_billing_mode: parsed.billingMode,
          p_slug: null as unknown as string,
          p_address: null as unknown as string,
          p_billing_data: null,
          p_full_name: nextFullName,
          p_email: nextEmail,
          p_phone: metadataPhone ?? undefined,
        },
      );

      if (createError || !organizationId) {
        throw createError ?? new Error("No se pudo crear la organizacion.");
      }

      await fetchProfile();

      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogo(user.id, organizationId, logoFile);
      }

      if (logoUrl) {
        const { error: logoUpdateError } = await supabase
          .from("organizations")
          .update({ logo_url: logoUrl })
          .eq("id", organizationId);
        if (logoUpdateError) throw logoUpdateError;
      }

      const user2 = await resolveUser();
      if (user2) {
        await supabase.from("onboarding_progress").upsert({
          user_id: user2.id,
          organization_id: organizationId,
          current_step: "payment",
          progress_data: asJsonObject({ organizationId, organizationDraft: { ...draft.value, logoPreviewUrl: null } }),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      if (import.meta.client) localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
      return organizationId;
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
