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
      title="Mis citas"
      description="Revisa tus proximas citas, historial de atencion y cambios de horario desde una vista pensada para autoservicio."
      icon="i-lucide-calendar-heart"
    />

    <UiEmptyModuleState
      title="Tus citas apareceran aqui"
      description="Cuando tengas reservas o visitas confirmadas, podras ver horarios, estados y detalles desde este espacio."
      icon="i-lucide-calendar-heart"
    >
      <template #actions>
        <UButton to="/client/bookings" color="primary" variant="soft">
          Explorar reservas
        </UButton>
        <UButton to="/client/profile" color="neutral" variant="soft">
          Revisar perfil
        </UButton>
      </template>
    </UiEmptyModuleState>
  </div>
</template>
