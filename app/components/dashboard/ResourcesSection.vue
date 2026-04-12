<script setup lang="ts">
const resources = [
  {
    title: "Guia de inicio",
    description: "Configura tu organizacion en pocos pasos y deja listo el arranque.",
    icon: "i-heroicons-book-open",
  },
  {
    title: "Usar el POS",
    description: "Conoce el flujo de ventas para cuando la cuenta este activa.",
    icon: "i-heroicons-shopping-cart",
  },
  {
    title: "Gestionar citas",
    description: "Aprende a ordenar agenda, servicios y disponibilidad del equipo.",
    icon: "i-heroicons-calendar-days",
  },
  {
    title: "Control de inventario",
    description: "Prepara stock, categorias y productos antes de abrir operaciones.",
    icon: "i-heroicons-archive-box",
  },
] as const;

defineEmits<{
  support: [];
}>();
</script>

<template>
  <UCard class="rounded-[1.5rem]">
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-bold text-slate-950 dark:text-white">
          <UIcon name="i-heroicons-academic-cap" class="mr-2 inline h-5 w-5" />
          Aprende a usar NexusPOS
        </h2>

        <UBadge color="neutral" variant="soft">Fase 2: docs y tour interactivo</UBadge>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <button
        v-for="resource in resources"
        :key="resource.title"
        class="flex items-start gap-3 rounded-xl border border-slate-200/80 p-4 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60"
        @click="$emit('support')"
      >
        <UIcon :name="resource.icon" class="h-6 w-6 flex-shrink-0 text-primary-500" />
        <div>
          <p class="font-medium text-slate-950 dark:text-white">{{ resource.title }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ resource.description }}</p>
        </div>
      </button>
    </div>
  </UCard>
</template>
