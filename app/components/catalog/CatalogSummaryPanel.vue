<script setup lang="ts">
const props = defineProps<{
  productsCount: number;
  servicesCount: number;
  categoriesCount: number;
}>();

const emits = defineEmits<{
  navigate: ["products" | "services" | "categories"];
}>();
</script>

<template>
  <UiSectionShell
    eyebrow="Resumen"
    title="Vista general del catalogo"
    description="Ingresa por area y gestiona productos, servicios y categorias desde un solo modulo."
  >
    <UiModuleHero
      eyebrow="Catalogo"
      title="Oferta comercial"
      description="Administra productos, servicios y categorias desde un modulo separado del control operativo de inventario."
      icon="i-lucide-box"
    />

    <div class="mt-5 grid gap-4 md:grid-cols-3">
      <UCard class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Productos</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.productsCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'products')">
          Ir a productos
        </UButton>
      </UCard>
      <UCard class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Servicios</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.servicesCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'services')">
          Ir a servicios
        </UButton>
      </UCard>
      <UCard class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Categorias</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.categoriesCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'categories')">
          Ir a categorias
        </UButton>
      </UCard>
    </div>
  </UiSectionShell>
</template>
