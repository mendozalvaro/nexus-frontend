<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "reservations.view",
  roles: ["admin", "manager", "employee"],
  moduleKey: "reservations",
});

await navigateTo("/reservations", { replace: true });
</script>

<template>
  <div />
</template>
