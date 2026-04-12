<script setup lang="ts">
const props = defineProps<{
  checking?: boolean;
  available?: boolean | null;
  suggestions?: string[];
}>();

const emit = defineEmits<{
  select: [value: string];
}>();

const toneClass = computed(() => {
  if (props.checking) {
    return "text-sky-600 dark:text-sky-300";
  }

  if (props.available === true) {
    return "text-emerald-600 dark:text-emerald-300";
  }

  if (props.available === false) {
    return "text-rose-600 dark:text-rose-300";
  }

  return "text-slate-500 dark:text-slate-400";
});

const message = computed(() => {
  if (props.checking) {
    return "Verificando disponibilidad...";
  }

  if (props.available === true) {
    return "Disponible";
  }

  if (props.available === false) {
    return "Este nombre no esta disponible";
  }

  return "Usa un nombre corto, claro y facil de recordar.";
});
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2 text-xs font-medium" :class="toneClass">
      <UIcon
        :name="checking ? 'i-lucide-loader-circle' : available ? 'i-lucide-badge-check' : available === false ? 'i-lucide-circle-alert' : 'i-lucide-info'"
        :class="checking ? 'animate-spin' : ''"
      />
      <span>{{ message }}</span>
    </div>

    <div v-if="(suggestions?.length ?? 0) > 0" class="flex flex-wrap gap-2">
      <UButton
        v-for="suggestion in suggestions"
        :key="suggestion"
        color="neutral"
        variant="soft"
        size="xs"
        @click="emit('select', suggestion)"
      >
        {{ suggestion }}
      </UButton>
    </div>
  </div>
</template>
