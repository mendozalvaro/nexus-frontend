<script setup lang="ts">
import { onMounted } from "vue";

definePageMeta({
  middleware: ["system-only"],
  title: "System Profile",
});

const {
  profile,
  loading,
  saving,
  error,
  success,
  formState,
  passwordState,
  loadProfile,
  saveProfile,
  changePassword,
} = useSystemProfile();

const handleProfileUpdate = (field: keyof typeof formState, value: string) => {
  (formState as any)[field] = value;
};

const handlePasswordUpdate = (field: keyof typeof passwordState, value: string) => {
  (passwordState as any)[field] = value;
};

onMounted(async () => {
  await loadProfile();
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">System</p>
      <h1 class="text-3xl font-bold text-slate-950 dark:text-white">Mi perfil</h1>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Revisa y actualiza tus datos de acceso de usuario system.
      </p>
    </div>

    <UCard class="rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
        Cargando perfil...
      </div>

      <template v-else>
        <UTabs :items="[
          { slot: 'general', label: 'General' },
          { slot: 'security', label: 'Seguridad' },
        ]">
          <template #general>
            <div class="space-y-6">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Rol</p>
                  <UBadge color="primary" variant="soft" class="capitalize">{{ profile?.role ?? "-" }}</UBadge>
                </div>
                <div class="space-y-2">
                  <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Estado</p>
                  <UBadge :color="profile?.is_active ? 'success' : 'neutral'" variant="soft">
                    {{ profile?.is_active ? "Activo" : "Inactivo" }}
                  </UBadge>
                </div>
              </div>

              <ProfileFormsSystemProfileForm
                :form-state="formState"
                :saving="saving"
                mode="general"
                @save="saveProfile"
                @update="handleProfileUpdate"
              />
            </div>
          </template>

          <template #security>
            <div class="space-y-6">
              <ProfileFormsSystemProfileForm
                :form-state="formState"
                :saving="saving"
                mode="password"
                @save="changePassword"
                @update-password="handlePasswordUpdate"
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
