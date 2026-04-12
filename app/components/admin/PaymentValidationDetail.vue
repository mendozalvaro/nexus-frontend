<template>
  <UCard class="admin-shell-panel rounded-[1.75rem]">
    <template #header>
      <div>
        <h2 class="text-xl font-semibold text-slate-950 dark:text-white">Detalle de validacion</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Placeholder seguro hasta introducir el admin de plataforma y su RLS dedicado.
        </p>
      </div>
    </template>

    <UAlert
      color="neutral"
      variant="soft"
      icon="i-lucide-file-lock-2"
      title="Sin acceso operativo en esta fase"
      description="Aqui viviran el visor de comprobantes, notas internas y acciones de aprobacion/rechazo."
    />
  </UCard>
</template>
