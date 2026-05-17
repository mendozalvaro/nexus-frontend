<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["admin", "manager", "employee"],
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
} = useTenantProfile();

const handleProfileUpdate = (field: keyof typeof formState, value: string) => {
  (formState as any)[field] = value;
};

onMounted(async () => {
  await loadProfile();
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">Perfil</h1>

    <UCard>
      <template #header>
        <h2 class="text-xl font-semibold">Mi perfil</h2>
      </template>

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
              <ProfileAvatarUpload
                :avatar-url="formState.avatarUrl"
                :full-name="profile?.full_name ?? ''"
                size="lg"
                @update="formState.avatarUrl = $event"
              />

              <ProfileFormsTenantProfileForm
                :form-state="formState"
                :saving="saving"
                @save="saveProfile"
                @update="handleProfileUpdate"
              />
            </div>
          </template>

          <template #security>
            <div class="space-y-4">
              <div class="space-y-3">
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Contrasena actual</label>
                <UInput
                  v-model="passwordState.currentPassword"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Ingresa tu contrasena actual"
                  size="lg"
                  class="w-full"
                />
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-3">
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nueva contrasena</label>
                  <UInput
                    v-model="passwordState.newPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Minimo 8 caracteres"
                    size="lg"
                    class="w-full"
                  />
                </div>

                <div class="space-y-3">
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar contrasena</label>
                  <UInput
                    v-model="passwordState.confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Repite la contrasena"
                    size="lg"
                    class="w-full"
                  />
                </div>
              </div>

              <div class="flex justify-end pt-2">
                <UButton color="primary" :loading="saving" @click="changePassword">
                  Cambiar contrasena
                </UButton>
              </div>
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
