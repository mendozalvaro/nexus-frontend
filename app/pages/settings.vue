<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "settings.view",
  roles: ["admin"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Administracion"
      title="Configuracion"
      description="Concentra plan, organizacion y preferencias globales en una experiencia mas clara y escalable."
      icon="i-lucide-settings-2"
    />

    <UiEmptyModuleState
      title="Configuracion en preparacion"
      description="Aqui viviran ajustes de organizacion, suscripcion, branding y preferencias globales del sistema."
      icon="i-lucide-settings-2"
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
