<script setup lang="ts">
import type { DashboardAccountStatus } from "@/composables/useDashboard";

defineProps<{
  accountStatus: DashboardAccountStatus;
}>();

defineEmits<{
  products: [];
  employees: [];
  branches: [];
}>();
</script>

<template>
  <UCard class="mb-6 rounded-[1.5rem]">
    <template #header>
      <h2 class="text-lg font-bold text-slate-950 dark:text-white">
        <UIcon name="i-heroicons-clipboard-document-check" class="mr-2 inline h-5 w-5" />
        Configura tu organizacion
      </h2>
    </template>

    <div class="space-y-3">
      <div class="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
        <UIcon name="i-heroicons-check-circle" class="h-5 w-5 flex-shrink-0" />
        <span class="text-sm">Cuenta creada y email verificado</span>
      </div>

      <div class="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
        <UIcon name="i-heroicons-check-circle" class="h-5 w-5 flex-shrink-0" />
        <span class="text-sm">Organizacion configurada</span>
      </div>

      <div class="flex items-center gap-3 text-amber-600 dark:text-amber-400">
        <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 flex-shrink-0 animate-spin" />
        <span class="text-sm">
          {{ accountStatus === "rejected" ? "Pago requiere reenvio" : "Pago en validacion" }}
        </span>
        <UBadge size="xs" color="warning" variant="soft">
          {{ accountStatus === "rejected" ? "Revision" : "Pendiente" }}
        </UBadge>
      </div>

      <button
        class="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left text-slate-700 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
        @click="$emit('products')"
      >
        <UIcon name="i-lucide-circle" class="h-5 w-5 flex-shrink-0" />
        <span class="text-sm">Agregar tus primeros productos</span>
      </button>

      <button
        class="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left text-slate-700 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
        @click="$emit('employees')"
      >
        <UIcon name="i-lucide-circle" class="h-5 w-5 flex-shrink-0" />
        <span class="text-sm">Registrar empleados</span>
      </button>

      <button
        class="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left text-slate-700 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
        @click="$emit('branches')"
      >
        <UIcon name="i-lucide-circle" class="h-5 w-5 flex-shrink-0" />
        <span class="text-sm">Revisar sucursal principal</span>
      </button>
    </div>
  </UCard>
</template>
