<script setup lang="ts">
import type { DashboardAccountStatus } from "@/composables/useDashboard";

defineProps<{
  fullName: string;
  organizationName: string;
  organizationSlug: string;
  accountStatus: DashboardAccountStatus;
}>();

defineEmits<{
  settings: [];
}>();
</script>

<template>
  <UCard class="mb-6 overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-primary-500 to-sky-600 text-white dark:from-primary-700 dark:to-sky-800">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-2xl font-bold md:text-3xl">
          Bienvenido, {{ fullName }}
        </h1>
        <p class="mt-2 text-sm text-primary-100 md:text-base">
          {{ organizationName }} • {{ organizationSlug }}
        </p>

        <UBadge
          v-if="accountStatus === 'pending'"
          color="warning"
          variant="solid"
          class="mt-3"
        >
          <UIcon name="i-heroicons-clock" class="mr-1 h-4 w-4" />
          Cuenta pendiente de activacion
        </UBadge>

        <UBadge
          v-else-if="accountStatus === 'rejected'"
          color="error"
          variant="solid"
          class="mt-3"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="mr-1 h-4 w-4" />
          Pago requiere correccion
        </UBadge>

        <UBadge
          v-else-if="accountStatus === 'suspended'"
          color="error"
          variant="solid"
          class="mt-3"
        >
          <UIcon name="i-heroicons-no-symbol" class="mr-1 h-4 w-4" />
          Cuenta suspendida
        </UBadge>
      </div>

      <div class="hidden md:block">
        <UButton
          variant="solid"
          color="neutral"
          icon="i-heroicons-cog-6-tooth"
          @click="$emit('settings')"
        >
          Configuracion
        </UButton>
      </div>
    </div>
  </UCard>
</template>
