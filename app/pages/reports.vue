<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "reports.view",
  roles: ["admin", "manager"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Analitica"
      title="Reportes"
      description="Consulta indicadores operativos y ejecutivos con una capa visual preparada para filtros, exportacion y comparativas."
      icon="i-lucide-bar-chart-3"
    />

    <UiEmptyModuleState
      title="Reportes en preparacion"
      description="Estamos armando dashboards, exportaciones y vistas avanzadas para acompanar decisiones por sucursal y organizacion."
      icon="i-lucide-bar-chart-3"
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
