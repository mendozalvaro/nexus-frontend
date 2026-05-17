<script setup lang="ts">
definePageMeta({
  layout: "client",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["client"],
});

const {
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
} = useClientProfile();

const handleGeneralUpdate = (field: keyof typeof formState, value: string) => {
  (formState as any)[field] = value;
};

const handleBillingUpdate = (field: keyof typeof billingState, value: string) => {
  (billingState as any)[field] = value;
};

onMounted(async () => {
  await loadProfile();
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiPageHeader
      eyebrow="Portal cliente"
      title="Mi perfil"
      description="Administra tu informacion personal, datos de contacto y preferencias desde un espacio simple y claro."
      surface
    />

    <UCard :ui="{ body: 'p-5 md:p-6' }">
      <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
        Cargando perfil...
      </div>

      <template v-else>
        <UTabs :items="[
          { slot: 'general', label: 'General' },
          { slot: 'billing', label: 'Facturacion' },
        ]">
          <template #general>
            <div class="space-y-6">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Estado</p>
                  <UBadge :color="clientProfile?.orgStatus === 'active' ? 'success' : 'neutral'" variant="soft" class="mt-2 capitalize">
                    {{ clientProfile?.orgStatus ?? "N/A" }}
                  </UBadge>
                </div>
              </div>

              <ProfileFormsClientProfileForm
                :form-state="formState"
                :billing-state="billingState"
                :saving="saving"
                mode="general"
                @save="saveProfile"
                @update-general="handleGeneralUpdate"
              />
            </div>
          </template>

          <template #billing>
            <div class="space-y-6">
              <ProfileFormsClientProfileForm
                :form-state="formState"
                :billing-state="billingState"
                :saving="saving"
                mode="billing"
                @save="saveBilling"
                @update-billing="handleBillingUpdate"
              />
            </div>
          </template>
        </UTabs>

        <UAlert
          v-if="success"
          color="success"
          variant="soft"
          icon="i-heroicons-check-circle"
          :title="success"
          class="mt-4"
        />

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          :title="error"
          class="mt-4"
        />
      </template>
    </UCard>
  </div>
</template>
