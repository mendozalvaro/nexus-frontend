<script setup lang="ts">
export interface SettingsTabItem {
  key: string;
  label: string;
  icon: string;
}

interface Props {
  tabs: SettingsTabItem[];
  modelValue: string;
}

interface Emits {
  (e: "update:modelValue", key: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="sticky top-16 z-20 -mx-1 rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-800 dark:bg-slate-950/85 sm:mx-0">
    <div class="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <UButton
        v-for="tab in props.tabs"
        :key="tab.key"
        type="button"
        :variant="props.modelValue === tab.key ? 'solid' : 'soft'"
        :color="props.modelValue === tab.key ? 'primary' : 'neutral'"
        :icon="tab.icon"
        size="md"
        :aria-pressed="props.modelValue === tab.key"
        class="min-h-11 shrink-0 rounded-2xl px-4"
        @click="emit('update:modelValue', tab.key)"
      >
        {{ tab.label }}
      </UButton>
    </div>
  </div>
</template>
