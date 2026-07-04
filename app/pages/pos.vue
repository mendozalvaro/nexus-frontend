<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "pos.sales.view",
  moduleKey: "pos.sales",
  roles: ["admin", "manager", "employee"],
});
</script>

<template>
  <NuxtPage />
</template>
