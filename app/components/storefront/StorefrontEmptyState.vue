<script setup lang="ts">
const props = defineProps<{
  businessType: "product" | "service" | "lodging";
  primaryColor: string;
}>();

const illustration = computed(() => {
  switch (props.businessType) {
    case "lodging":
      return {
        icon: "i-lucide-bed-double",
        title: "Sin habitaciones disponibles",
        desc: "Agrega habitaciones desde el panel de administracion para empezar a recibir reservas.",
      };
    case "service":
      return {
        icon: "i-lucide-concierge-bell",
        title: "Sin servicios disponibles",
        desc: "Agrega servicios desde el panel de administracion para empezar a recibir consultas.",
      };
    default:
      return {
        icon: "i-lucide-package-open",
        title: "Sin productos disponibles",
        desc: "Agrega productos desde el panel de administracion para empezar a vender.",
      };
  }
});
</script>

<template>
  <div class="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center backdrop-blur-sm transition-all duration-500"
    :style="{
      borderColor: `${primaryColor}25`,
      backgroundColor: `${primaryColor}04`,
    }"
  >
    <div
      class="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
      :style="{ backgroundColor: `${primaryColor}10` }"
    >
      <UIcon :name="illustration.icon" class="h-10 w-10" :style="{ color: primaryColor }" />
    </div>
    <h3 class="text-base font-semibold text-slate-900 dark:text-white">
      {{ illustration.title }}
    </h3>
    <p class="mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
      {{ illustration.desc }}
    </p>
  </div>
</template>
