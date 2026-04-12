<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["admin", "manager", "employee"],
});

const { profile } = useAuth();
</script>

<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">Perfil</h1>

    <UCard>
      <template #header>
        <h2 class="text-xl font-semibold">Información Personal</h2>
      </template>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Nombre Completo</label>
          <p class="text-gray-900 dark:text-gray-100">{{ profile?.full_name }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <p class="text-gray-900 dark:text-gray-100">{{ profile?.email }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Rol</label>
          <p class="text-gray-900 dark:text-gray-100 capitalize">{{ profile?.role }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
