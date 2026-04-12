<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["admin", "manager", "employee", "client"],
});

const { signOut } = useAuth();

const goHome = () => {
  navigateTo("/dashboard");
};

const handleSignOut = async () => {
  await signOut();
};
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center">
    <UCard class="w-full max-w-md text-center">
      <template #header>
        <UIcon name="i-heroicons-shield-exclamation" class="mx-auto mb-4 h-16 w-16 text-red-500" />
        <h1 class="text-2xl font-bold">Acceso Denegado</h1>
      </template>

      <div class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          Esta vista se conserva como referencia manual. Las denegaciones normales ahora regresan al dashboard.
        </p>

        <div class="flex gap-2">
          <UButton class="flex-1" @click="goHome">
            Ir al Dashboard
          </UButton>
          <UButton variant="outline" class="flex-1" @click="handleSignOut">
            Cerrar Sesion
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
