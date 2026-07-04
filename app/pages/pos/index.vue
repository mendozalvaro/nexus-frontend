<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.sales.view",
  moduleKey: "pos.sales",
  roles: ["admin", "manager", "employee"],
});

if (import.meta.server) {
  await navigateTo("/pos/sell", { replace: true });
}

onMounted(() => {
  void navigateTo("/pos/sell", { replace: true });
});
</script>

<template>
  <div class="py-8 text-sm text-slate-500">Redirigiendo a Vender...</div>
</template>
