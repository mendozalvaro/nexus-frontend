<script setup lang="ts">
const props = defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  create: [];
}>();
</script>

<template>
  <div class="flex items-center justify-end gap-2">
    <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="emit('refresh')">
      Actualizar
    </UButton>
    <UButton color="primary" icon="i-lucide-plus" @click="emit('create')">
      Nuevo ingreso
    </UButton>
  </div>
</template>
