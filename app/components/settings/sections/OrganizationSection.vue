<script setup lang="ts">
import type { SettingsOrganization } from "@/composables/useSettings";
import type { UpdateOrgPayload } from "@/composables/useSettings";

interface Props {
  org: SettingsOrganization | null;
  loading: boolean;
  mutationLoading: boolean;
  error: string | null;
}

interface Emits {
  (e: "submit", payload: UpdateOrgPayload): void;
  (e: "upload-logo", file: File): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-3">
    <div class="lg:col-span-2">
      <UCard class="rounded-3xl">
        <template #header>
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Datos de la organizacion</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Informacion general que aparece en facturas y reportes.</p>
          </div>
        </template>
        <SettingsFormsOrganizationForm
          :org="org"
          :loading="loading"
          :mutation-loading="mutationLoading"
          :error="error"
          @submit="emit('submit', $event)"
        />
      </UCard>
    </div>

    <div>
      <UCard class="rounded-3xl">
        <template #header>
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Vista previa</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Como se ve tu organizacion en el sistema.</p>
          </div>
        </template>
        <div class="space-y-4">
          <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                <img
                  v-if="org?.logo_url"
                  :src="org.logo_url"
                  alt="Logo"
                  class="h-full w-full object-cover"
                />
                <UIcon
                  v-else
                  name="i-lucide-building-2"
                  class="h-6 w-6 text-slate-400"
                />
              </div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-900 dark:text-white">{{ org?.name ?? 'Tu organizacion' }}</p>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ org?.slug ?? 'sin-slug' }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Factura ejemplo</p>
            <div class="mt-2 space-y-1 text-sm">
              <p class="font-medium text-slate-900 dark:text-white">{{ org?.name ?? 'Tu organizacion' }}</p>
              <p class="text-slate-500 dark:text-slate-400">{{ org?.address ?? 'Sin direccion' }}</p>
              <p class="text-slate-500 dark:text-slate-400">{{ org?.timezone ?? 'America/La_Paz' }} · {{ org?.currency_code ?? 'BOB' }}</p>
            </div>
          </div>

          <SettingsFormsLogoUpload
            :org="org"
            :loading="loading"
            :mutation-loading="mutationLoading"
            :error="null"
            @upload="emit('upload-logo', $event)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
