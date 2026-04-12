<script setup lang="ts">
import type { NavigationItem } from "@/types/permissions";

const props = defineProps<{
  items: NavigationItem[];
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  navigate: [];
}>();

const route = useRoute();

const normalizePath = (path: string): string => {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
};

const isActive = (item: NavigationItem) => {
  if (item.disabled) {
    return false;
  }

  const currentPath = normalizePath(route.path);
  const itemPath = normalizePath(item.to);

  if (currentPath === itemPath) {
    return true;
  }

  if (!currentPath.startsWith(`${itemPath}/`)) {
    return false;
  }

  const hasMoreSpecificMatch = props.items.some((candidate) => {
    if (candidate.disabled || candidate.to === item.to) {
      return false;
    }

    const candidatePath = normalizePath(candidate.to);
    return (
      currentPath === candidatePath ||
      currentPath.startsWith(`${candidatePath}/`)
    ) && candidatePath.length > itemPath.length;
  });

  return !hasMoreSpecificMatch;
};
</script>

<template>
  <nav class="space-y-1.5">
    <NuxtLink
      v-for="item in items"
      :key="`${item.label}:${item.to}`"
      :to="item.to"
      :title="collapsed ? item.label : undefined"
      class="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/90 dark:hover:text-white"
      :class="[
        isActive(item) ? 'bg-sky-50 text-sky-700 shadow-sm shadow-sky-100/80 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:shadow-none dark:ring-sky-900/80' : '',
        item.disabled ? 'border border-dashed border-amber-300/70 bg-amber-50/70 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40' : '',
        collapsed ? 'justify-center px-2' : '',
      ]"
      @click="emit('navigate')"
    >
      <span
        class="absolute inset-y-2 left-1 w-1 rounded-full bg-sky-500 opacity-0 transition-opacity duration-200"
        :class="isActive(item) ? 'opacity-100' : 'group-hover:opacity-60'"
        aria-hidden="true"
      />
      <UIcon
        :name="item.icon"
        class="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
      />
      <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
      <UBadge
        v-if="item.badge && !collapsed"
        color="warning"
        variant="subtle"
        size="sm"
        class="ml-auto shrink-0 rounded-full"
      >
        {{ item.badge }}
      </UBadge>
      <span v-if="collapsed" class="sr-only">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
