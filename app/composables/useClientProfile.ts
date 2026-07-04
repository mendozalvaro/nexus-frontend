import type { ClientProfileState } from "@/types/client";

export interface ClientProfileFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface ClientBillingFormState {
  companyName: string;
  taxId: string;
  address: string;
  city: string;
  notes: string;
}

const defaultFormState = (): ClientProfileFormState => ({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
});

const defaultBillingState = (): ClientBillingFormState => ({
  companyName: "",
  taxId: "",
  address: "",
  city: "",
  notes: "",
});

export const useClientProfile = () => {
  const clientProfile = useState<ClientProfileState | null>("client:profile:data", () => null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  const formState = reactive<ClientProfileFormState>(defaultFormState());
  const billingState = reactive<ClientBillingFormState>(defaultBillingState());

  const setFormFromProfile = (p: ClientProfileState | null) => {
    if (!p) return;
    formState.firstName = p.firstName ?? "";
    formState.lastName = p.lastName ?? "";
    formState.phone = p.phone ?? "";
    formState.email = p.email ?? "";

    const billing = p.billingData ?? {};
    billingState.companyName = (billing.company_name as string) ?? "";
    billingState.taxId = (billing.tax_id as string) ?? "";
    billingState.address = (billing.address as string) ?? "";
    billingState.city = (billing.city as string) ?? "";
    billingState.notes = (billing.notes as string) ?? "";
  };

  const loadProfile = async () => {
    loading.value = true;
    error.value = null;
    success.value = null;

    try {
      const response = await $fetch<{ profile: ClientProfileState | null }>("/api/clients/profile");
      clientProfile.value = response.profile;
      if (clientProfile.value) {
        setFormFromProfile(clientProfile.value);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cargar el perfil.";
    } finally {
      loading.value = false;
    }
  };

  const saveProfile = async () => {
    error.value = null;
    success.value = null;

    if (!formState.firstName.trim()) {
      error.value = "El nombre es obligatorio.";
      return;
    }

    if (!formState.email.trim() && !formState.phone.trim()) {
      error.value = "Debes proporcionar al menos un email o telefono.";
      return;
    }

    saving.value = true;

    try {
      const response = await $fetch<{ profile: ClientProfileState }>("/api/clients/profile", {
        method: "PATCH",
        body: {
          firstName: formState.firstName.trim(),
          lastName: formState.lastName.trim() || null,
          phone: formState.phone.trim() || null,
          email: formState.email.trim() || null,
        },
      });

      clientProfile.value = response.profile;
      setFormFromProfile(response.profile);
      success.value = "Perfil actualizado correctamente.";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar el perfil.";
    } finally {
      saving.value = false;
    }
  };

  const saveBilling = async () => {
    error.value = null;
    success.value = null;

    saving.value = true;

    try {
      const billingData: Record<string, unknown> = {};
      if (billingState.companyName.trim()) billingData.company_name = billingState.companyName.trim();
      if (billingState.taxId.trim()) billingData.tax_id = billingState.taxId.trim();
      if (billingState.address.trim()) billingData.address = billingState.address.trim();
      if (billingState.city.trim()) billingData.city = billingState.city.trim();
      if (billingState.notes.trim()) billingData.notes = billingState.notes.trim();

      const response = await $fetch<{ profile: ClientProfileState }>("/api/clients/profile", {
        method: "PATCH",
        body: {
          firstName: formState.firstName.trim(),
          lastName: formState.lastName.trim() || null,
          phone: formState.phone.trim() || null,
          email: formState.email.trim() || null,
          billingData,
        },
      });

      clientProfile.value = response.profile;
      setFormFromProfile(response.profile);
      success.value = "Datos de facturacion actualizados correctamente.";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar la facturacion.";
    } finally {
      saving.value = false;
    }
  };

  const resetForm = () => {
    Object.assign(formState, defaultFormState());
    if (clientProfile.value) {
      setFormFromProfile(clientProfile.value);
    }
    error.value = null;
    success.value = null;
  };

  const resetBillingForm = () => {
    Object.assign(billingState, defaultBillingState());
    if (clientProfile.value) {
      setFormFromProfile(clientProfile.value);
    }
    error.value = null;
    success.value = null;
  };

  return {
    clientProfile,
    loading,
    saving,
    error,
    success,
    formState,
    billingState,
    loadProfile,
    saveProfile,
    saveBilling,
    resetForm,
    resetBillingForm,
  };
};
