<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "appointments.view",
  roles: ["admin", "manager", "employee"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Operacion"
      title="Citas"
      description="Organiza agenda, disponibilidad y seguimiento del cliente con una experiencia clara para equipo y negocio."
      icon="i-lucide-calendar-days"
    />

    <UiEmptyModuleState
      title="Agenda en preparacion"
      description="La vista final integrara calendario, disponibilidad, reprogramaciones y contexto del cliente en tiempo real."
      icon="i-lucide-calendar-days"
    >
      <template #actions>
        <UButton to="/dashboard" color="neutral" variant="soft">
          Volver al dashboard
        </UButton>
        <UButton to="/profile" color="primary" variant="soft">
          Revisar perfil
        </UButton>
      </template>
    </UiEmptyModuleState>
  </div>
</template>
