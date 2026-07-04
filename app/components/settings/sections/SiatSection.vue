<script setup lang="ts">
import type { SettingsSiatConfig, UpdateSiatPayload } from "@/composables/useSettings";

interface Props {
  config: SettingsSiatConfig | null;
  loading: boolean;
  mutationLoading: boolean;
  error: string | null;
}

interface Emits {
  (e: "submit", payload: UpdateSiatPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = reactive<UpdateSiatPayload>({
  razon_social: "",
  nit: "",
  regimen_tributario: undefined,
  actividad_economica: "",
  sucursal_siat: "",
  direccion_matriz: "",
  codigo_autorizacion: "",
  punto_venta: "",
  sistema_facturacion: undefined,
  codigo_sistema: "",
  resolucion_numero: "",
  is_active: false,
});

const regimenOptions = [
  { value: "general" as const, label: "General" },
  { value: "simplificado" as const, label: "Simplificado" },
  { value: "especial" as const, label: "Especial" },
];

const sistemaOptions = [
  { value: "propio" as const, label: "Sistema propio" },
  { value: "terceros" as const, label: "Sistema de terceros" },
  { value: "siat_línea" as const, label: "SIAT en línea" },
];

watch(
  () => props.config,
  (cfg) => {
    if (!cfg) return;
    form.razon_social = cfg.razon_social ?? "";
    form.nit = cfg.nit ?? "";
    form.regimen_tributario = cfg.regimen_tributario ?? undefined;
    form.actividad_economica = cfg.actividad_economica ?? "";
    form.sucursal_siat = cfg.sucursal_siat ?? "";
    form.direccion_matriz = cfg.direccion_matriz ?? "";
    form.codigo_autorizacion = cfg.codigo_autorizacion ?? "";
    form.punto_venta = cfg.punto_venta ?? "";
    form.sistema_facturacion = cfg.sistema_facturacion ?? undefined;
    form.codigo_sistema = cfg.codigo_sistema ?? "";
    form.resolucion_numero = cfg.resolucion_numero ?? "";
    form.is_active = cfg.is_active ?? false;
  },
  { immediate: true },
);

const handleSubmit = () => {
  emit("submit", { ...form });
};
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-8">
    <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary-500" />
  </div>

  <template v-else>
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Toggle first -->
      <UCard class="rounded-3xl">
        <template #header>
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Habilitar SIAT</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Activa la emisión de facturas en línea Bolivia.</p>
          </div>
        </template>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-slate-900 dark:text-white">emisión SIAT activa</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">Al habilitar, se mostrarán los campos de configuración.</p>
          </div>
          <USwitch v-model="form.is_active" />
        </div>
      </UCard>

      <!-- Config fields (only when active) -->
      <template v-if="form.is_active">
        <!-- Datos Fiscales -->
        <UCard class="rounded-3xl">
          <template #header>
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Datos fiscales</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Información tributaria requerida por el SIAT.</p>
            </div>
          </template>
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Razón social">
              <UInput v-model="form.razon_social" placeholder="Empresa SRL" />
            </UFormField>

            <UFormField label="NIT">
              <UInput v-model="form.nit" placeholder="1234567890" />
            </UFormField>

            <UFormField label="Régimen tributario">
              <USelect v-model="form.regimen_tributario" :options="regimenOptions" placeholder="Seleccionar" />
            </UFormField>

            <UFormField label="Actividad económica">
              <UInput v-model="form.actividad_economica" placeholder="Comercio al por menor..." />
            </UFormField>

            <UFormField label="Sucursal SIAT">
              <UInput v-model="form.sucursal_siat" placeholder="Central" />
            </UFormField>

            <UFormField label="Direccion matriz">
              <UInput v-model="form.direccion_matriz" placeholder="Av. Principal #123" />
            </UFormField>
          </div>
        </UCard>

        <!-- Certificacion -->
        <UCard class="rounded-3xl">
          <template #header>
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Certificacion SIAT</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Datos de autorización para emisión de facturas.</p>
            </div>
          </template>
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Codigo de autorización">
              <UInput v-model="form.codigo_autorizacion" placeholder="ABC123-DEF456" />
            </UFormField>

            <UFormField label="Punto de venta">
              <UInput v-model="form.punto_venta" placeholder="001" />
            </UFormField>

            <UFormField label="Sistema de facturación">
              <USelect v-model="form.sistema_facturacion" :options="sistemaOptions" placeholder="Seleccionar" />
            </UFormField>

            <UFormField label="Codigo de sistema">
              <UInput v-model="form.codigo_sistema" placeholder="SF-12345" />
            </UFormField>

            <UFormField label="Número de resolución">
              <UInput v-model="form.resolucion_numero" placeholder="RES-2024-001" />
            </UFormField>
          </div>
        </UCard>
      </template>

      <!-- Error + Submit -->
      <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
        <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
      </div>

      <div class="flex justify-end">
        <UButton
          type="submit"
          color="primary"
          :loading="mutationLoading"
          :disabled="mutationLoading"
        >
          Guardar configuración SIAT
        </UButton>
      </div>
    </form>
  </template>
</template>


