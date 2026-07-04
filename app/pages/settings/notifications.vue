<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "settings.edit",
  roles: ["admin"],
  moduleKey: "settings",
});
await navigateTo("/settings");
</script>

<template>
  <div />
</template>
