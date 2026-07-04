<script setup lang="ts">
const props = defineProps<{
  showProducts?: boolean;
  showServices?: boolean;
  showRooms?: boolean;
  productsCount: number;
  productCategoriesCount: number;
  servicesCount: number;
  serviceCategoriesCount: number;
  roomsCount: number;
  roomCategoriesCount: number;
}>();

const emits = defineEmits<{
  navigate: ["products" | "product-categories" | "services" | "service-categories" | "rooms" | "room-categories"];
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

    <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <UCard v-if="showProducts" class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Productos</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.productsCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'products')">
          Ir a productos
        </UButton>
      </UCard>
      <UCard v-if="showProducts" class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Categorias Productos</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.productCategoriesCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'product-categories')">
          Ir a categorias
        </UButton>
      </UCard>
      <UCard v-if="showServices" class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Servicios</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.servicesCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'services')">
          Ir a servicios
        </UButton>
      </UCard>
      <UCard v-if="showServices" class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Categorias Servicios</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.serviceCategoriesCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'service-categories')">
          Ir a categorias
        </UButton>
      </UCard>
      <UCard v-if="showRooms" class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Habitaciones</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.roomsCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'rooms')">
          Ir a habitaciones
        </UButton>
      </UCard>
      <UCard v-if="showRooms" class="rounded-[1.25rem]">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Categorias Habitaciones</p>
        <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{{ props.roomCategoriesCount }}</p>
        <UButton class="mt-4" color="primary" variant="soft" block @click="emits('navigate', 'room-categories')">
          Ir a categorias
        </UButton>
      </UCard>
    </div>
  </UiSectionShell>
</template>
