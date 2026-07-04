<script setup lang="ts">
import type { PublicStorefrontItem } from "@/types/storefront";

const props = defineProps<{
  items: PublicStorefrontItem[];
  primaryColor: string;
  accentColor: string;
}>();

const emit = defineEmits<{
  change: [category: string | null];
}>();

const categories = computed(() => {
  const badges = new Set<string>();
  props.items.forEach((item) => {
    if (item.badge) badges.add(item.badge);
  });
  return Array.from(badges).sort();
});

const activeCategory = ref<string | null>(null);

const selectCategory = (category: string | null) => {
  activeCategory.value = category;
  emit("change", category);
};

const clearFilter = () => selectCategory(null);
</script>

<template>
  <div v-if="categories.length > 1" class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
    <button
      :class="activeCategory === null
        ? 'text-white shadow-sm'
        : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'"
      class="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200"
      :style="activeCategory === null ? { backgroundColor: primaryColor } : {}"
      @click="clearFilter"
    >
      Todos
    </button>
    <button
      v-for="cat in categories"
      :key="cat"
      :class="activeCategory === cat
        ? 'text-white shadow-sm'
        : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'"
      class="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200"
      :style="activeCategory === cat ? { backgroundColor: accentColor } : {}"
      @click="selectCategory(cat)"
    >
      {{ cat }}
    </button>
  </div>
</template>
