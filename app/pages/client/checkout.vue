<script setup lang="ts">
definePageMeta({
  middleware: ["permissions"],
  roles: ["client"],
  title: "Checkout cliente",
});
</script>

<template>
  <main class="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <section class="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <p class="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Cliente</p>
      <h1 class="mt-2 text-3xl font-semibold">Checkout</h1>
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Esta ruta requiere autenticación de cliente activa.
      </p>
    </section>
  </main>
</template>
