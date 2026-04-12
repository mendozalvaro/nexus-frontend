<script setup lang="ts">
definePageMeta({
  layout: "client",
  middleware: ["permissions"],
  permission: "appointments.view",
  roles: ["client"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Portal cliente"
      title="Reservas"
      description="Encuentra espacios disponibles, revisa proximas experiencias y prepara nuevas solicitudes desde el portal."
      icon="i-lucide-ticket"
    />

    <UiEmptyModuleState
      title="Reservas en preparacion"
      description="Muy pronto podras reservar servicios y seguir cada solicitud desde una experiencia enfocada en cliente."
      icon="i-lucide-ticket"
    >
      <template #actions>
        <UButton to="/client/appointments" color="primary" variant="soft">
          Ver mis citas
        </UButton>
        <UButton to="/client/dashboard" color="neutral" variant="soft">
          Volver al portal
        </UButton>
      </template>
    </UiEmptyModuleState>
  </div>
</template>
