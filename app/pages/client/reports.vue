<script setup lang="ts">
definePageMeta({
  layout: "client",
  middleware: ["permissions"],
  permission: "reports.view",
  roles: ["client"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Portal cliente"
      title="Mi actividad"
      description="Consulta un resumen claro de tu historial, citas completadas y proximas interacciones con la organizacion."
      icon="i-lucide-chart-column"
    />

    <UiEmptyModuleState
      title="Actividad en preparacion"
      description="Este espacio reunira historial de atencion, reservas y eventos relevantes para que tengas trazabilidad de tu experiencia."
      icon="i-lucide-chart-column"
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
