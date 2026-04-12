<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "users.view",
  roles: ["admin", "manager"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Administracion"
      title="Usuarios"
      description="Gestiona personas, roles y acceso por sucursal desde una base visual consistente y facil de auditar."
      icon="i-lucide-users"
    />

    <UiEmptyModuleState
      title="Gestion de usuarios en preparacion"
      description="Muy pronto tendras alta, edicion, estados y asignaciones por sucursal desde un solo flujo consistente."
      icon="i-lucide-users"
    >
      <template #actions>
        <UButton to="/dashboard" color="neutral" variant="soft">
          Volver al dashboard
        </UButton>
        <UButton to="/profile" color="primary" variant="soft">
          Ver mi perfil
        </UButton>
      </template>
    </UiEmptyModuleState>
  </div>
</template>
