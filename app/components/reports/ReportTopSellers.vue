<script setup lang="ts">
import type { ProductsReportData, ServicesReportData } from "@/composables/useReports";

const props = defineProps<{
  productsData: ProductsReportData | null;
  servicesData: ServicesReportData | null;
}>();

interface TopItem {
  name: string;
  kind: "producto" | "servicio";
  value: string;
  volume: string;
  icon: string;
}

const topItems = computed<TopItem[]>(() => {
  const result: TopItem[] = [];

  const topProducts = props.productsData?.topProducts ?? [];
  for (const p of topProducts.slice(0, 5)) {
    result.push({
      name: p.label,
      kind: "producto",
      value: p.value.toString(),
      volume: `${p.value} uds`,
      icon: "i-lucide-package",
    });
  }

  const topServices = props.servicesData?.topServices ?? [];
  for (const s of topServices.slice(0, 5)) {
    result.push({
      name: s.label,
      kind: "servicio",
      value: s.value.toString(),
      volume: `${s.value} veces`,
      icon: "i-lucide-wrench",
    });
  }

  result.sort((a, b) => Number(b.value) - Number(a.value));
  return result.slice(0, 5);
});
</script>

<template>
  <UCard class="rounded-2xl border border-white/60 bg-white/85 dark:border-slate-800 dark:bg-slate-900/80">
    <template #header>
      <h3 class="text-base font-semibold text-slate-950 dark:text-white">
        Top 5 mas vendido
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Productos y servicios combinados por volumen
      </p>
    </template>

    <div v-if="topItems.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
      Sin datos en este periodo
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="(item, index) in topItems"
        :key="item.name"
        class="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-800/60"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          :class="{
            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300': index === 0,
            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300': index === 1,
            'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300': index === 2,
            'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500': index > 2,
          }"
        >
          {{ index + 1 }}
        </span>
        <UIcon :name="item.icon" class="h-5 w-5 text-slate-400 dark:text-slate-500" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
            {{ item.name }}
          </p>
          <UBadge size="xs" variant="soft" :color="item.kind === 'producto' ? 'primary' : 'warning'" class="mt-1">
            {{ item.kind }}
          </UBadge>
        </div>
        <span class="shrink-0 text-sm font-semibold text-slate-950 dark:text-white">
          {{ item.volume }}
        </span>
      </div>
    </div>
  </UCard>
</template>
