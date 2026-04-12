<script setup lang="ts">
import type { NavigationItem } from "../../composables/useNavigation";

const route = useRoute();

const props = withDefaults(
  defineProps<{
    items: NavigationItem[];
    title: string;
    collapsed?: boolean;
  }>(),
  {
    collapsed: false,
  },
);

const emit = defineEmits<{
  close: [];
  itemClick: [item: NavigationItem];
}>();

const expandedGroups = ref<string[]>([]);

const isItemActive = (item: NavigationItem): boolean => {
  if (route.path === item.to || route.fullPath === item.to || route.path.startsWith(`${item.to}/`)) {
    return true;
  }

  return item.children?.some((child) => isItemActive(child)) ?? false;
};

const toggleGroup = (label: string) => {
  if (expandedGroups.value.includes(label)) {
    expandedGroups.value = expandedGroups.value.filter((group) => group !== label);
    return;
  }

  expandedGroups.value = [...expandedGroups.value, label];
};

watch(
  () => route.path,
  () => {
    const activeParents = props.items
      .filter((item) => item.children?.some((child) => isItemActive(child)))
      .map((item) => item.label);

    expandedGroups.value = Array.from(new Set([...expandedGroups.value, ...activeParents]));
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="collapsed"
        type="button"
        class="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        aria-label="Cerrar men&uacute; lateral"
        @click="emit('close')"
      />
    </Transition>

    <aside
      class="fixed inset-y-0 left-0 z-40 flex h-screen w-80 max-w-[calc(100vw-1rem)] flex-col min-h-0 border-r border-slate-200/70 bg-white/94 backdrop-blur-xl transition-transform duration-300 ease-out dark:border-slate-800/80 dark:bg-slate-950/94"
      :class="collapsed ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      aria-label="Barra lateral principal"
    >
      <div class="flex items-center justify-between border-b border-slate-200/70 px-5 py-5 dark:border-slate-800/80">
        <div class="flex min-w-0 items-center gap-3">
          <div class="nexus-logo-shell flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-lg">
            NP
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">NexusPOS</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ title }}</p>
          </div>
        </div>

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="admin-interactive admin-focus-ring lg:hidden"
          aria-label="Cerrar men&uacute; lateral"
          @click="emit('close')"
        />
      </div>

      <nav class="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 py-5" aria-label="Navegaci&oacute;n por rol">
        <div v-for="item in items" :key="item.to" class="space-y-2">
          <NuxtLink
            v-if="!item.children?.length"
            :to="item.to"
            class="admin-focus-ring admin-interactive group flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
            :class="
              isItemActive(item)
                ? 'bg-primary-50 text-primary-700 shadow-sm shadow-primary-500/10 dark:bg-primary-500/15 dark:text-primary-200'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white'
            "
            @click="emit('itemClick', item); emit('close')"
          >
            <UIcon :name="item.icon" class="mt-0.5 h-5 w-5 shrink-0" />
            <div class="min-w-0">
              <p class="font-medium">{{ item.label }}</p>
              <p
                v-if="item.description"
                class="mt-0.5 truncate text-xs text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
              >
                {{ item.description }}
              </p>
            </div>
          </NuxtLink>

          <div v-else class="rounded-3xl border border-transparent p-1 transition-colors duration-200">
            <button
              type="button"
              class="admin-focus-ring admin-interactive group flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left text-sm"
              :class="
                isItemActive(item)
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white'
              "
              :aria-expanded="expandedGroups.includes(item.label)"
              @click="toggleGroup(item.label)"
            >
              <UIcon :name="item.icon" class="mt-0.5 h-5 w-5 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="font-medium">{{ item.label }}</p>
                <p
                  v-if="item.description"
                  class="mt-0.5 truncate text-xs text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
                >
                  {{ item.description }}
                </p>
              </div>
              <UIcon
                name="i-lucide-chevron-down"
                class="mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200"
                :class="expandedGroups.includes(item.label) ? 'rotate-180' : ''"
              />
            </button>

            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="translate-y-1 opacity-0"
              enter-to-class="translate-y-0 opacity-100"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="translate-y-0 opacity-100"
              leave-to-class="translate-y-1 opacity-0"
            >
              <div
                v-show="expandedGroups.includes(item.label)"
                class="mt-1 space-y-1 rounded-2xl bg-slate-50/90 p-2 dark:bg-slate-900/70"
              >
                <NuxtLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  class="admin-focus-ring admin-interactive flex items-center gap-3 rounded-2xl px-3 py-2 text-sm"
                  :class="
                    isItemActive(child)
                      ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-950 dark:text-primary-200'
                      : 'text-slate-700 hover:bg-white hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-white'
                  "
                  @click="emit('itemClick', child); emit('close')"
                >
                  <UIcon :name="child.icon" class="h-4 w-4 shrink-0" />
                  <span class="truncate">{{ child.label }}</span>
                </NuxtLink>
              </div>
            </Transition>
          </div>
        </div>
      </nav>

      <div class="border-t border-slate-200/70 px-4 py-4 dark:border-slate-800/80">
        <p class="text-xs text-slate-600 dark:text-slate-300">
          Navegaci&oacute;n contextual por rol, compatible con tema claro y oscuro.
        </p>
      </div>
    </aside>
  </div>
</template>
