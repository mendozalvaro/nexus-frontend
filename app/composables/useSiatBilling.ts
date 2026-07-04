import type { SettingsSiatConfig } from "@/composables/useSettings";

export const useSiatBilling = () => {
  const siatConfig = useState<SettingsSiatConfig | null>("siat:billing-config", () => null);
  const loaded = useState<boolean>("siat:billing-loaded", () => false);
  const loading = useState<boolean>("siat:billing-loading", () => false);

  const loadSiatBilling = async (force = false) => {
    if (loading.value) {
      return siatConfig.value;
    }

    if (loaded.value && !force) {
      return siatConfig.value;
    }

    loading.value = true;

    try {
      siatConfig.value = await $fetch<SettingsSiatConfig | null>("/api/siat");
    } catch {
      siatConfig.value = null;
    } finally {
      loaded.value = true;
      loading.value = false;
    }

    return siatConfig.value;
  };

  const siatBillingEnabled = computed(() => siatConfig.value?.is_active === true);

  return {
    siatConfig,
    siatBillingEnabled,
    siatBillingLoading: loading,
    loadSiatBilling,
  };
};
