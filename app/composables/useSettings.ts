import type { Ref } from "vue";

export interface SettingsOrganization {
  id: string;
  name: string;
  slug: string | null;
  timezone: string | null;
  currency_code: string | null;
  country: string | null;
  business_type: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  updated_at: string | null;
}

export interface SettingsSubscription {
  id: string;
  billing_mode: string | null;
  payment_method: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  invoice_name: string | null;
  doc_type: "nit" | "ci" | "pasaporte" | "cedula" | null;
  doc_number: string | null;
  updated_at: string | null;
}

export interface UpdateOrgPayload {
  name?: string;
  slug?: string;
  timezone?: string;
  currency_code?: string;
  country?: string;
  business_type?: "products" | "services" | "hybrid";
  address?: string | null;
}

export interface UpdateSubPayload {
  billing_mode?: "monthly" | "quarterly" | "annual";
  payment_method?: "tarjeta" | "efectivo" | "transferencia" | "qr";
}

export interface UpdateBillingDataPayload {
  invoice_name?: string;
  doc_type?: "nit" | "ci" | "pasaporte" | "cedula";
  doc_number?: string;
}

export interface SettingsSiatConfig {
  id: string;
  razon_social: string | null;
  nit: string | null;
  regimen_tributario: "general" | "simplificado" | "especial" | null;
  actividad_economica: string | null;
  sucursal_siat: string | null;
  direccion_matriz: string | null;
  codigo_autorizacion: string | null;
  punto_venta: string | null;
  sistema_facturacion: "propio" | "terceros" | "siat_linea" | null;
  codigo_sistema: string | null;
  resolucion_numero: string | null;
  is_active: boolean | null;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UpdateSiatPayload {
  razon_social?: string;
  nit?: string;
  regimen_tributario?: "general" | "simplificado" | "especial";
  actividad_economica?: string;
  sucursal_siat?: string;
  direccion_matriz?: string;
  codigo_autorizacion?: string;
  punto_venta?: string;
  sistema_facturacion?: "propio" | "terceros" | "siat_linea";
  codigo_sistema?: string;
  resolucion_numero?: string;
  is_active?: boolean;
}

export const useSettings = () => {
  const { refreshOrganization } = useGlobalOrganization();
  const { loadCapabilities, capabilities } = useSubscription();

  const organization = useState<SettingsOrganization | null>("settings:organization", () => null) as Ref<SettingsOrganization | null>;
  const subscription = useState<SettingsSubscription | null>("settings:subscription", () => null) as Ref<SettingsSubscription | null>;
  const siatConfig = useState<SettingsSiatConfig | null>("settings:siat", () => null) as Ref<SettingsSiatConfig | null>;
  const orgLoading = useState<boolean>("settings:org-loading", () => false);
  const subLoading = useState<boolean>("settings:sub-loading", () => false);
  const siatLoading = useState<boolean>("settings:siat-loading", () => false);
  const mutationLoading = useState<boolean>("settings:mutation-loading", () => false);
  const error = useState<string | null>("settings:error", () => null);

  const loadOrganization = async () => {
    orgLoading.value = true;
    error.value = null;
    try {
      organization.value = await $fetch<SettingsOrganization>("/api/organization");
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cargar la organizacion.";
    } finally {
      orgLoading.value = false;
    }
  };

  const loadSubscription = async () => {
    subLoading.value = true;
    error.value = null;
    try {
      subscription.value = await $fetch<SettingsSubscription>("/api/subscription");
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cargar la suscripcion.";
    } finally {
      subLoading.value = false;
    }
  };

  const updateOrganization = async (payload: UpdateOrgPayload) => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const updated = await $fetch<SettingsOrganization>("/api/settings/organization", {
        method: "PATCH",
        body: payload,
      });
      organization.value = updated;
      await refreshOrganization();
      await loadCapabilities(undefined, { force: true });
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar la organizacion.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const updateLogo = async (file: File) => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const result = await $fetch<{ id: string; logo_url: string }>("/api/settings/organization-logo", {
        method: "POST",
        body: formData,
      });
      if (organization.value) {
        organization.value = { ...organization.value, logo_url: result.logo_url };
      }
      await refreshOrganization();
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar el logo.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const updateSubscription = async (payload: UpdateSubPayload) => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const updated = await $fetch<SettingsSubscription>("/api/settings/subscription", {
        method: "PATCH",
        body: payload,
      });
      subscription.value = updated;
      await loadCapabilities(undefined, { force: true });
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar la suscripcion.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const updateBillingData = async (payload: UpdateBillingDataPayload) => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const updated = await $fetch<SettingsSubscription>("/api/subscription/billing-data", {
        method: "PATCH",
        body: payload,
      });
      if (subscription.value) {
        subscription.value = { ...subscription.value, ...updated };
      }
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar los datos de facturacion.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const deactivateOrganization = async () => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const updated = await $fetch<SettingsOrganization>("/api/settings/organization", {
        method: "PATCH",
        body: { is_active: false },
      });
      organization.value = updated;
      await refreshOrganization();
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo desactivar la organizacion.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  const loadSiatConfig = async () => {
    siatLoading.value = true;
    error.value = null;
    try {
      siatConfig.value = await $fetch<SettingsSiatConfig | null>("/api/siat");
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cargar la configuracion SIAT.";
    } finally {
      siatLoading.value = false;
    }
  };

  const updateSiatConfig = async (payload: UpdateSiatPayload) => {
    mutationLoading.value = true;
    error.value = null;
    try {
      const updated = await $fetch<SettingsSiatConfig>("/api/siat", {
        method: "PATCH",
        body: payload,
      });
      siatConfig.value = updated;
      return updated;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar la configuracion SIAT.";
      throw e;
    } finally {
      mutationLoading.value = false;
    }
  };

  return {
    organization,
    subscription,
    siatConfig,
    capabilities,
    orgLoading,
    subLoading,
    siatLoading,
    mutationLoading,
    error,
    loadOrganization,
    loadSubscription,
    loadSiatConfig,
    updateOrganization,
    updateLogo,
    updateSubscription,
    updateBillingData,
    updateSiatConfig,
    deactivateOrganization,
  };
};
