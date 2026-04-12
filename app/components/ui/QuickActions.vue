<script setup lang="ts">
interface QuickActionItem {
  label: string;
  description: string;
  icon: string;
  to?: string;
  colorClass?: string;
}

defineProps<{
  title?: string;
  description?: string;
  actions: readonly QuickActionItem[];
}>();
</script>

<template>
  <section class="space-y-4 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/20 md:p-5">
    <div v-if="title || description" class="space-y-1">
      <p v-if="title" class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {{ title }}
      </p>
      <p v-if="description" class="text-sm text-slate-500 dark:text-slate-400">
        {{ description }}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <NuxtLink
        v-for="action in actions"
        :key="action.label"
        :to="action.to || '#'"
        class="group rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-700"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            :class="action.colorClass || 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'"
          >
            <UIcon :name="action.icon" class="h-5 w-5" />
          </div>

          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900 transition group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-300">
              {{ action.label }}
            </p>
            <p class="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {{ action.description }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
