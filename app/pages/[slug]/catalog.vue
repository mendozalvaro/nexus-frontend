<script setup lang="ts">
const route = useRoute();

const slug = computed(() => {
  const value = route.params.slug;
  return typeof value === "string" ? value : "";
});

definePageMeta({
  layout: false,
});

useSeoMeta({
  title: () => (slug.value ? `Catálogo | ${slug.value}` : "Catálogo"),
  description: "Catálogo público por organización.",
});
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <section class="mx-auto max-w-4xl rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <p class="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Catálogo Público</p>
      <h1 class="mt-2 text-3xl font-semibold">{{ slug }}</h1>
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Explora productos y servicios sin iniciar sesión.
      </p>
    </section>
  </main>
</template>
