<script setup lang="ts">
definePageMeta({
  layout: "client",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["client"],
});

const { profile } = useAuth();
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiPageHeader
      eyebrow="Portal cliente"
      title="Mi perfil"
      description="Administra tu informacion personal, datos de contacto y preferencias desde un espacio simple y claro."
      surface
    />

    <UCard :ui="{ body: 'p-5 md:p-6' }">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
            Nombre completo
          </p>
          <p class="mt-2 text-base font-semibold text-slate-900 dark:text-white">
            {{ profile?.full_name || "Sin nombre registrado" }}
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
            Email
          </p>
          <p class="mt-2 text-base font-semibold text-slate-900 dark:text-white">
            {{ profile?.email || "Sin email registrado" }}
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
            Rol
          </p>
          <p class="mt-2 text-base font-semibold text-slate-900 dark:text-white">
            Cliente
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
            Estado del portal
          </p>
          <p class="mt-2 text-base font-semibold text-slate-900 dark:text-white">
            Activo
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
