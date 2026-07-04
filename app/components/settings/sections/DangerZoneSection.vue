<script setup lang="ts">
import type { SettingsOrganization } from "@/composables/useSettings";

interface Props {
  org: SettingsOrganization | null;
  mutationLoading: boolean;
}

interface Emits {
  (e: "deactivate"): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const modalOpen = ref(false);

const handleConfirm = () => {
  modalOpen.value = false;
  emit("deactivate");
};
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Acción irreversible"
      description="Desactivar la organización bloqueará el acceso para todos los usuarios y cancelará operaciones pendientes."
    />

    <UAlert
      color="error"
      variant="soft"
      icon="i-lucide-circle-x"
      title="Consecuencias"
    >
      <template #description>
        <ul class="mt-1 space-y-1 text-sm">
          <li>• Se bloqueará el acceso para todos los usuarios</li>
          <li>• Se cancelarán citas pendientes automáticamente</li>
          <li>• Se bloquearán operaciones de inventario y ventas</li>
          <li>• Se enviará un email de confirmación al administrador</li>
        </ul>
      </template>
    </UAlert>

    <UCard :ui="{ body: 'p-4' }">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-slate-900 dark:text-white">Desactivar {{ org?.name ?? 'organización' }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Esta acción no se puede deshacer. Todos los datos permanecerán pero inaccesibles.
          </p>
        </div>
        <UButton
          color="error"
          variant="soft"
          :disabled="mutationLoading || org?.is_active === false"
          @click="modalOpen = true"
        >
          {{ org?.is_active === false ? "Ya desactivada" : "Desactivar" }}
        </UButton>
      </div>
    </UCard>

    <SettingsModalsDeactivateOrgModal
      :open="modalOpen"
      :loading="mutationLoading"
      :org-name="org?.name ?? ''"
      @update:open="modalOpen = $event"
      @confirm="handleConfirm"
    />
  </div>
</template>

