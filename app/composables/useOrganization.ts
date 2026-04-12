import type { Database } from "@/types/database.types";
import type {
  OrganizationDraft,
  SlugValidationResult,
} from "@/types/registration";

const createOrganizationDraft = (): OrganizationDraft => ({
  organizationName: "",
  slug: "",
  timezone: "America/La_Paz",
  currency: "USD",
  address: "",
  billingData: {
    businessName: "",
    taxId: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    email: "",
  },
  logoPreviewUrl: null,
  logoFileName: null,
});

export const useOrganization = () => {
  const supabase = useSupabaseClient<Database>();
  const { resolveUser } = useSessionAccess();
  const { fetchProfile } = useAuth();
  const { saveOnboardingProgress, loadOnboardingProgress, registrationDraft } = useRegistration();

  const draft = useState<OrganizationDraft>(
    "onboarding:organization:draft",
    createOrganizationDraft,
  );
  const loading = useState<boolean>(
    "onboarding:organization:loading",
    () => false,
  );
  const slugChecking = useState<boolean>(
    "onboarding:organization:slug-checking",
    () => false,
  );
  const error = useState<string | null>(
    "onboarding:organization:error",
    () => null,
  );
  const logoError = useState<string | null>(
    "onboarding:organization:logo-error",
    () => null,
  );
  const draftHydrated = useState<boolean>(
    "onboarding:organization:draft-hydrated",
    () => false,
  );
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const mergeDraft = (nextValue: Partial<OrganizationDraft>) => {
    draft.value = {
      ...createOrganizationDraft(),
      ...draft.value,
      ...nextValue,
      billingData: {
        ...createOrganizationDraft().billingData,
        ...draft.value.billingData,
        ...nextValue.billingData,
      },
    };
  };

  const hydrateDraft = async () => {
    try {
      const fallbackCountry = getCountryByCode(registrationDraft.value.country);
      const baseDraft: OrganizationDraft = {
        ...createOrganizationDraft(),
        timezone: fallbackCountry?.timezone ?? "America/La_Paz",
        currency: fallbackCountry?.currency ?? "USD",
        billingData: {
          ...createOrganizationDraft().billingData,
          phone: registrationDraft.value.phone,
          email: registrationDraft.value.email,
          country: registrationDraft.value.country,
        },
      };

      mergeDraft(baseDraft);

      if (!import.meta.client) {
        draftHydrated.value = true;
        return;
      }

      const rawValue = localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      if (!rawValue) {
        const progress = await loadOnboardingProgress();
        const remoteDraft = progress?.progress_data && typeof progress.progress_data === "object"
          ? (progress.progress_data as { organizationDraft?: Partial<OrganizationDraft> }).organizationDraft
          : undefined;

        if (remoteDraft) {
          mergeDraft(remoteDraft);
        }
      } else {
        mergeDraft(JSON.parse(rawValue) as OrganizationDraft);
      }
    } catch {
      if (import.meta.client) {
        localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
      }

      mergeDraft(createOrganizationDraft());
    } finally {
      draftHydrated.value = true;
    }
  };

  const persistDraft = () => {
    if (!import.meta.client) {
      return;
    }

    localStorage.setItem(
      ORGANIZATION_STORAGE_KEY,
      JSON.stringify({
        ...draft.value,
        logoPreviewUrl: null,
      }),
    );
  };

  /**
   * Valida disponibilidad del slug y genera sugerencias alternativas.
   */
  const validateSlug = async (
    candidate: string,
  ): Promise<SlugValidationResult> => {
    const normalizedSlug = slugifyValue(candidate);

    if (!normalizedSlug || normalizedSlug.length < 3) {
      return {
        available: false,
        normalizedSlug,
        suggestions: [],
      };
    }

    slugChecking.value = true;

    try {
      const { data, error: slugError } = await supabase
        .from("organizations")
        .select("slug")
        .eq("slug", normalizedSlug)
        .maybeSingle();

      if (slugError) {
        throw slugError;
      }

      const available = !data;
      const suggestions = available
        ? []
        : [
            `${normalizedSlug}-1`,
            `${normalizedSlug}-oficial`,
            `${normalizedSlug}-${new Date().getFullYear()}`,
          ];

      return {
        available,
        normalizedSlug,
        suggestions,
      };
    } finally {
      slugChecking.value = false;
    }
  };

  /**
   * Valida el archivo del logo en cliente antes de subirlo a Storage.
   */
  const validateLogoFile = (file: File) => {
    logoError.value = null;

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      const logoValidationError = new Error("El logo supera el limite de 2MB.");
      logoError.value = logoValidationError.message;
      throw logoValidationError;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      const logoValidationError = new Error("El logo debe ser JPG, PNG o WebP.");
      logoError.value = logoValidationError.message;
      throw logoValidationError;
    }
  };

  /**
   * Sube el logo de la organizacion al bucket `organization-assets`.
   */
  const uploadLogo = async (
    userId: string,
    organizationId: string,
    file: File,
  ): Promise<string | null> => {
    validateLogoFile(file);

    const storagePath = buildOrganizationLogoStoragePath(
      userId,
      organizationId,
      file.type,
    );

    const { error: uploadError } = await supabase.storage
      .from("organization-assets")
      .upload(storagePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("organization-assets")
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  /**
   * Guarda el progreso parcial del formulario de organizacion en DB.
   */
  const saveDraftToProgress = async () => {
    await saveOnboardingProgress({
      currentStep: "organization",
      progressData: asJsonObject({
        organizationDraft: {
          ...draft.value,
          logoPreviewUrl: null,
        },
      }),
    });
  };

  /**
   * Limpia el logo actualmente seleccionado del borrador local.
   */
  const clearLogo = () => {
    logoError.value = null;

    if (draft.value.logoPreviewUrl && import.meta.client) {
      URL.revokeObjectURL(draft.value.logoPreviewUrl);
    }

    draft.value = {
      ...draft.value,
      logoPreviewUrl: null,
      logoFileName: null,
    };
  };

  /**
   * Crea la organizacion y vincula al usuario como admin pendiente de activacion.
   */
  const createOrganization = async (logoFile: File | null) => {
    loading.value = true;
    error.value = null;

    try {
      const parsed = ORGANIZATION_SCHEMA.parse({
        organizationName: draft.value.organizationName,
        slug: draft.value.slug,
        timezone: draft.value.timezone,
        currency: draft.value.currency,
        address: draft.value.address,
        billingData: draft.value.billingData,
      });

      const user = await resolveUser();
      if (!user) {
        throw new Error("Tu sesion no es valida. Inicia sesion nuevamente.");
      }

      const profile = await fetchProfile();
      if (profile?.organization_id) {
        return profile.organization_id;
      }

      const slugResult = await validateSlug(parsed.slug);
      if (!slugResult.available) {
        throw new Error(ERROR_MESSAGES.SLUG_TAKEN);
      }

      const userMetadata =
        (user.user_metadata as Record<string, unknown> | undefined) ?? {};
      const metadataFullName =
        typeof userMetadata.full_name === "string"
          ? sanitizeText(userMetadata.full_name)
          : "";
      const metadataPhone =
        typeof userMetadata.phone === "string"
          ? sanitizeNullableText(userMetadata.phone)
          : null;
      const nextFullName =
        sanitizeText(registrationDraft.value.fullName) ||
        profile?.full_name ||
        metadataFullName ||
        "Administrador NexusPOS";
      const nextPhone =
        sanitizeNullableText(registrationDraft.value.phone) ??
        profile?.phone ??
        metadataPhone;
      const nextEmail = sanitizeText(
        profile?.email ?? user.email ?? registrationDraft.value.email,
      );

      const { data: organizationId, error: createError } = await supabase.rpc(
        "create_onboarding_organization",
        {
          p_name: sanitizeText(parsed.organizationName),
          p_slug: slugResult.normalizedSlug,
          p_timezone: parsed.timezone,
          p_currency: parsed.currency,
          p_address: sanitizeText(parsed.address),
          p_billing_data: parsed.billingData,
          p_full_name: nextFullName,
          p_email: nextEmail,
          p_phone: nextPhone ?? undefined,
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

        if (logoUpdateError) {
          throw logoUpdateError;
        }
      }

      await saveOnboardingProgress({
        currentStep: "payment",
        organizationId,
        progressData: asJsonObject({
          organizationId,
          organizationDraft: {
            ...draft.value,
            logoPreviewUrl: null,
            logoFileName: logoFile?.name ?? null,
          },
        }),
      });

      if (import.meta.client) {
        localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
      }

      return organizationId;
    } catch (organizationError) {
      const message =
        organizationError instanceof Error
          ? organizationError.message
          : "No se pudo crear la organizacion.";

      if (
        organizationError instanceof Error &&
        organizationError.message.toLowerCase().includes("logo")
      ) {
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
  watch(
    draft,
    () => {
      if (!import.meta.client || !draftHydrated.value) {
        return;
      }

      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(async () => {
        await saveDraftToProgress();
      }, 800);
    },
    { deep: true },
  );

  return {
    countries: COUNTRIES,
    timezones: TIMEZONES,
    currencies: CURRENCIES,
    draft,
    loading,
    slugChecking,
    error,
    logoError,
    hydrateDraft,
    persistDraft,
    validateSlug,
    saveDraftToProgress,
    createOrganization,
    clearLogo,
    validateLogoFile,
    getCurrencyOptionsForCountry,
    getTimezoneOptionsForCountry,
  };
};
