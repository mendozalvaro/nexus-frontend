import type { StorefrontAccess, StorefrontSettings } from "@/types/storefront";

export interface StorefrontSettingsResponse {
  settings: StorefrontSettings;
  access: StorefrontAccess;
}

export interface UpdateStorefrontPayload {
  slug: string;
  businessType: StorefrontSettings["businessType"];
  templateKey: StorefrontSettings["templateKey"];
  colorPresetKey: StorefrontSettings["colorPresetKey"];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
  isPublished: boolean;
}

export const useStorefrontSettings = () => {
  const settings = useState<StorefrontSettings | null>("storefront:settings", () => null);
  const access = useState<StorefrontAccess | null>("storefront:access", () => null);
  const loading = useState<boolean>("storefront:loading", () => false);
  const mutationLoading = useState<boolean>("storefront:mutation-loading", () => false);
  const error = useState<string | null>("storefront:error", () => null);

  const loadStorefront = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<StorefrontSettingsResponse>("/api/settings/storefront");
      settings.value = response.settings;
      access.value = response.access;
      return response;
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : "No se pudo cargar la tienda virtual.";
      settings.value = null;
      access.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  };

  const updateStorefront = async (payload: UpdateStorefrontPayload) => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const response = await $fetch<StorefrontSettingsResponse>("/api/settings/storefront", {
        method: "PATCH",
        body: payload,
      });
      settings.value = response.settings;
      access.value = response.access;
      return response;
    } catch (updateError) {
      error.value = updateError instanceof Error ? updateError.message : "No se pudo guardar la tienda virtual.";
      throw updateError;
    } finally {
      mutationLoading.value = false;
    }
  };

  return {
    settings,
    access,
    loading,
    mutationLoading,
    error,
    loadStorefront,
    updateStorefront,
  };
};
