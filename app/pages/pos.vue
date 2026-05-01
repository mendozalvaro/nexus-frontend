<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.view",
  roles: ["admin", "manager", "employee"],
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Operacion"
      title="Punto de Venta"
      description="Prepara una experiencia de cobro hibrida, rapida y clara para caja, servicios y flujo comercial en sucursal."
      icon="i-lucide-shopping-cart"
    />

    <GlobalBranchContextSelector
      module-key="pos"
      title="Contexto de venta"
      description="Este contexto fija la sucursal para el flujo operativo del POS."
    />

    <UiEmptyModuleState
      title="Punto de venta en preparacion"
      description="Estamos terminando la experiencia completa del POS para ventas rapidas, carrito hibrido y atajos operativos."
      icon="i-lucide-shopping-cart"
    >
      <template #actions>
        <UButton to="/dashboard" color="neutral" variant="soft">
          Volver al dashboard
        </UButton>
        <UButton to="/appointments" color="primary" variant="soft">
          Abrir agenda
        </UButton>
      </template>
    </UiEmptyModuleState>
  </div>
</template>
