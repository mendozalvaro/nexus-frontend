<script setup lang="ts">
import type { UpdateBillingDataPayload, UpdateOrgPayload, UpdateSiatPayload } from "@/composables/useSettings";
import type { StorefrontBusinessType } from "@/types/storefront";
import type { SubscriptionPlanSlug } from "@/types/subscription";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "settings.view",
  roles: ["admin"],
  moduleKey: "settings",
});

const activeTab = ref<"organization" | "storefront" | "subscription" | "siat" | "preferences" | "notifications" | "danger" | "billing-history">("organization");

const {
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
  removeLogo,
  updateBillingData,
  updateSiatConfig,
  deactivateOrganization,
} = useSettings();

const {
  history,
  historyLoading,
  historyTotal,
  mutationLoading: billingMutationLoading,
  error: billingError,
  loadHistory,
  changePlan,
  cancelSubscription,
  clearError: clearBillingError,
} = useBilling();

const {
  settings: storefrontSettings,
  access: storefrontAccess,
  loading: storefrontLoading,
  mutationLoading: storefrontMutationLoading,
  error: storefrontError,
  loadStorefront,
  updateStorefront,
} = useStorefrontSettings();

const { profile } = useAuth();

const showPlanChangeModal = ref(false);
const showCancelModal = ref(false);
const cancelReason = ref("");

onMounted(async () => {
  await Promise.all([loadOrganization(), loadSubscription(), loadStorefront()]);
});

watch(activeTab, async (tab) => {
  if (tab === "subscription" && history.value.length === 0) {
    await loadHistory(5, 0);
  }

  if (tab === "siat" && !siatConfig.value && !siatLoading.value) {
    await loadSiatConfig();
  }

  if (tab === "billing-history" && history.value.length === 0) {
    await loadHistory();
  }
});

watch(
  () => storefrontAccess.value?.canView,
  (canView) => {
    if (activeTab.value === "storefront" && canView === false) {
      activeTab.value = "organization";
    }
  },
);

const availableStorefrontBusinessTypes = computed<StorefrontBusinessType[]>(() => {
  const values = capabilities.value?.businessTypes ?? [];
  const filtered = values.filter((value): value is StorefrontBusinessType =>
    value === "product" || value === "service" || value === "lodging",
  );

  return filtered.length ? filtered : ["product"];
});

const tabs = computed(() => [
  { key: "organization" as const, label: "Organizacion", icon: "i-lucide-building-2" },
  ...(storefrontAccess.value?.canView
    ? [{ key: "storefront" as const, label: "Tienda Virtual", icon: "i-lucide-store" }]
    : []),
  { key: "subscription" as const, label: "Suscripcion", icon: "i-lucide-credit-card" },
  { key: "siat" as const, label: "Facturacion SIAT", icon: "i-lucide-receipt" },
  { key: "preferences" as const, label: "Preferencias", icon: "i-lucide-palette" },
  { key: "notifications" as const, label: "Notificaciones", icon: "i-lucide-bell-ring" },
  { key: "danger" as const, label: "Zona peligrosa", icon: "i-lucide-triangle-alert" },
]);

const handleUpdateOrg = async (payload: UpdateOrgPayload) => {
  try {
    await updateOrganization(payload);
  } catch {
    // Error handled in composable
  }
};

const handleUploadLogo = async (file: File) => {
  try {
    await updateLogo(file);
  } catch {
    // Error handled in composable
  }
};

const handleRemoveLogo = async () => {
  try {
    await removeLogo();
  } catch {
    // Error handled in composable
  }
};

const handleUpdateBillingData = async (payload: UpdateBillingDataPayload) => {
  try {
    await updateBillingData(payload);
  } catch {
    // Error handled in composable
  }
};

const handleUpdateStorefront = async (payload: {
  slug: string;
  businessType: StorefrontBusinessType;
  templateKey: import("@/types/storefront").StorefrontTemplateKey;
  colorPresetKey: import("@/types/storefront").StorefrontColorPresetKey;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
  isPublished: boolean;
}) => {
  try {
    await updateStorefront(payload);
    await loadOrganization();
  } catch {
    // Error handled in composable
  }
};

const handleUpdateSiat = async (payload: UpdateSiatPayload) => {
  try {
    await updateSiatConfig(payload);
  } catch {
    // Error handled in composable
  }
};

const handleDeactivate = async () => {
  try {
    await deactivateOrganization();
    const { sendAccountDeactivatedEmail } = useNotifications();
    const profileEmail = profile.value?.email;
    if (profileEmail) {
      await sendAccountDeactivatedEmail(organization.value?.name ?? "Organizacion", profileEmail);
    }
  } catch {
    // Error handled in composable
  }
};

const handlePlanChange = async (planSlug: SubscriptionPlanSlug, billingMode: "monthly" | "quarterly" | "annual") => {
  try {
    await changePlan({ plan_slug: planSlug, billing_mode: billingMode });
    showPlanChangeModal.value = false;
  } catch {
    // Error handled in composable
  }
};

const handleCancel = async () => {
  try {
    await cancelSubscription({ confirm: true, reason: cancelReason.value || undefined });
    showCancelModal.value = false;
    cancelReason.value = "";
  } catch {
    // Error handled in composable
  }
};

const handleLoadMoreHistory = async () => {
  await loadHistory(50, history.value.length);
};
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <SettingsTabNav v-model="activeTab" :tabs="tabs" />

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-x"
      :title="error"
      @click:close="error = null"
    />

    <UAlert
      v-if="billingError"
      color="error"
      variant="soft"
      icon="i-lucide-circle-x"
      :title="billingError"
      @click:close="clearBillingError"
    />

    <UAlert
      v-if="storefrontError"
      color="error"
      variant="soft"
      icon="i-lucide-circle-x"
      :title="storefrontError"
    />

    <UCard v-if="orgLoading || subLoading || storefrontLoading" class="rounded-3xl">
      <div class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary-500" />
      </div>
    </UCard>

    <div v-else :key="activeTab" class="space-y-6">
      <SettingsSectionsOrganizationSection
        v-if="activeTab === 'organization'"
        :org="organization"
        :loading="orgLoading"
        :mutation-loading="mutationLoading"
        :error="error"
        @submit="handleUpdateOrg"
        @upload-logo="handleUploadLogo"
        @remove-logo="handleRemoveLogo"
      />

      <SettingsSectionsStorefrontSection
        v-else-if="activeTab === 'storefront'"
        :settings="storefrontSettings"
        :access="storefrontAccess"
        :loading="storefrontLoading"
        :mutation-loading="storefrontMutationLoading"
        :error="storefrontError"
        :available-business-types="availableStorefrontBusinessTypes"
        @submit="handleUpdateStorefront"
      />

      <SettingsSectionsSubscriptionSection
        v-else-if="activeTab === 'subscription'"
        :subscription="subscription"
        :capabilities="capabilities"
        :loading="subLoading"
        :mutation-loading="billingMutationLoading || mutationLoading"
        :error="billingError || error"
        :history-entries="history"
        :history-loading="historyLoading"
        @update-billing="handleUpdateBillingData"
        @change-plan="showPlanChangeModal = true"
        @cancel="showCancelModal = true"
        @view-history="activeTab = 'billing-history'"
      />

      <SettingsSectionsSiatSection
        v-else-if="activeTab === 'siat'"
        :config="siatConfig ?? null"
        :loading="siatLoading"
        :mutation-loading="mutationLoading"
        :error="error"
        @submit="handleUpdateSiat"
      />

      <SettingsSectionsPreferencesSection
        v-else-if="activeTab === 'preferences'"
        :org="organization"
        :mutation-loading="mutationLoading"
        @submit="handleUpdateOrg"
      />

      <SettingsSectionsNotificationsSection v-else-if="activeTab === 'notifications'" />

      <UCard v-else-if="activeTab === 'danger'" class="rounded-3xl">
        <SettingsSectionsDangerZoneSection
          :org="organization"
          :mutation-loading="mutationLoading"
          @deactivate="handleDeactivate"
        />
      </UCard>

      <UCard v-else-if="activeTab === 'billing-history'" class="rounded-3xl">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Historial de facturacion</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ historyTotal }} transacciones registradas.</p>
            </div>
            <UButton variant="ghost" color="neutral" size="sm" icon="i-lucide-arrow-left" @click="activeTab = 'subscription'">
              Volver a Suscripcion
            </UButton>
          </div>
        </template>
        <SettingsTablesBillingHistoryTable
          :entries="history"
          :loading="historyLoading"
          :total="historyTotal"
          @load-more="handleLoadMoreHistory"
        />
      </UCard>
    </div>

    <SettingsModalsPlanChangeModal
      v-if="showPlanChangeModal"
      :current-plan-slug="capabilities?.planSlug ?? null"
      :current-billing-mode="subscription?.billing_mode as 'monthly' | 'quarterly' | 'annual' | null"
      :loading="billingMutationLoading"
      @close="showPlanChangeModal = false"
      @confirm="handlePlanChange"
    />

    <UModal v-if="showCancelModal" :open="true" @update:open="showCancelModal = false">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-red-600 dark:text-red-400">Cancelar suscripcion</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tu acceso continuara hasta el fin del periodo actual. Esta accion no se puede deshacer.
          </p>

          <div class="mt-4">
            <UFormField label="Motivo (opcional)">
              <UTextarea v-model="cancelReason" placeholder="Cuentanos por que cancelas..." :rows="3" />
            </UFormField>
          </div>

          <div class="mt-4 flex items-center justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="showCancelModal = false">
              Volver
            </UButton>
            <UButton
              color="error"
              :loading="billingMutationLoading"
              @click="handleCancel"
            >
              Confirmar cancelacion
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
