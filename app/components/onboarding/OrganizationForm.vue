<script setup lang="ts">
import type { OrganizationDraft } from "@/types/registration";
import { countriesList } from "../../utils/constants";

const props = defineProps<{
  modelValue: OrganizationDraft;
  loading?: boolean;
  slugChecking?: boolean;
  slugAvailable?: boolean | null;
  slugSuggestions?: string[];
  error?: string | null;
  logoError?: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: OrganizationDraft];
  "logo-selected": [file: File];
  "clear-logo": [];
  "save-later": [];
  submit: [];
}>();

const state = reactive<OrganizationDraft>({ ...props.modelValue });
const { getCurrencyOptionsForCountry, getTimezoneOptionsForCountry } = useOrganization();
const { registrationDraft } = useRegistration();

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(state, value);
  },
  { deep: true },
);

watch(
  state,
  (value) => {
    emit("update:modelValue", { ...value, billingData: { ...value.billingData } });
  },
  { deep: true },
);

const timezoneOptions = computed(() =>
  getTimezoneOptionsForCountry(registrationDraft.value.country),
);
const currencyOptions = computed(() =>
  getCurrencyOptionsForCountry(registrationDraft.value.country),
);
const onLogoSelected = (file: File) => {
  emit("logo-selected", file);
};
</script>

<template>
  <UCard class="admin-shell-panel rounded-[1.75rem]">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-2xl font-semibold text-slate-950 dark:text-white">Configura tu organizacion</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Guardamos tu avance automaticamente para que puedas retomar despues.
        </p>
      </div>
    </template>

    <div class="space-y-5">
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="error"
      />

      <UForm
        :schema="ORGANIZATION_SCHEMA"
        :state="state"
        :validate-on="['blur']"
        class="space-y-6"
        @submit="emit('submit')"
      >
        <div class="grid gap-4 md:grid-cols-2 md:gap-5">
          <UFormField
            class="sm:col-span-2"
            label="Nombre de la empresa"
            name="organizationName"
            hint="Lo usaremos en reportes, documentos y branding inicial."
          >
            <UInput
              v-model="state.organizationName"
              size="lg"
              icon="i-lucide-building-2"
              autofocus
              autocomplete="organization"
              :ui="{ base: 'min-h-11 text-base' }"
            />
          </UFormField>

          <UFormField
            label="Slug"
            name="slug"
            hint="Sera parte de tu referencia interna y de futuras URLs."
          >
            <UInput
              v-model="state.slug"
              size="lg"
              icon="i-lucide-at-sign"
              autocomplete="off"
              spellcheck="false"
              :ui="{ base: 'min-h-11 text-base' }"
            />
            <SlugValidator
              class="mt-2"
              :checking="slugChecking"
              :available="slugAvailable"
              :suggestions="slugSuggestions"
              @select="state.slug = $event"
            />
          </UFormField>

          <UFormField
            label="Direccion principal"
            name="address"
            hint="Direccion fisica de la sucursal principal."
          >
            <UInput v-model="state.address" size="lg" icon="i-lucide-map-pinned" :ui="{ base: 'min-h-11 text-base' }" />
          </UFormField>

          <UFormField label="Zona horaria" name="timezone">
            <USelectMenu
              v-model="state.timezone"
              :items="timezoneOptions"
              value-key="value"
              label-key="label"
              searchable
              size="lg"
              :ui="{ base: 'min-h-11 text-base' }"
            />
          </UFormField>

          <UFormField label="Moneda" name="currency">
            <USelectMenu
              v-model="state.currency"
              :items="currencyOptions"
              value-key="code"
              label-key="label"
              searchable
              size="lg"
              :ui="{ base: 'min-h-11 text-base' }"
            />
          </UFormField>
        </div>

        <div class="rounded-[1.5rem] border border-slate-200/80 p-4 dark:border-slate-800">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-slate-950 dark:text-white">Datos de facturacion</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                Fase 2: aqui podemos validar RUC, NIT o DNI segun el pais.
              </p>
            </div>
            <UBadge color="neutral" variant="soft">JSON seguro</UBadge>
          </div>

          <div class="grid gap-4 md:grid-cols-2 md:gap-5">
            <UFormField label="Razon social" name="billingData.businessName">
              <UInput v-model="state.billingData.businessName" size="lg" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField label="Tax ID / NIT" name="billingData.taxId">
              <UInput v-model="state.billingData.taxId" size="lg" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField label="Direccion fiscal" name="billingData.address">
              <UInput v-model="state.billingData.address" size="lg" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField label="Ciudad" name="billingData.city">
              <UInput v-model="state.billingData.city" size="lg" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField label="Pais de facturacion" name="billingData.country">
              <UInput
                v-model="state.billingData.country"
                list="billing-countries"
                size="lg"
                :ui="{ base: 'min-h-11 text-base' }"
              />
              <datalist id="billing-countries">
                <option v-for="country in countriesList" :key="country.value" :value="country.value">
                  {{ country.label }}
                </option>
              </datalist>
            </UFormField>

            <UFormField label="Telefono" name="billingData.phone">
              <UInput v-model="state.billingData.phone" size="lg" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField class="sm:col-span-2" label="Email de facturacion" name="billingData.email">
              <UInput v-model="state.billingData.email" size="lg" type="email" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>
        </div>

        <LogoUpload
          :preview-url="state.logoPreviewUrl"
          :file-name="state.logoFileName"
          :error="logoError"
          @select="onLogoSelected"
          @clear="emit('clear-logo')"
        />

        <div class="flex flex-col gap-3 sm:flex-row">
          <UButton
            color="neutral"
            variant="soft"
            class="min-h-11 sm:flex-1"
            @click="emit('save-later')"
          >
            Guardar y continuar despues
          </UButton>

          <UButton
            type="submit"
            :loading="loading"
            class="auth-submit-button min-h-11 sm:flex-1"
          >
            {{ loading ? "Creando organizacion..." : "Continuar al pago" }}
          </UButton>
        </div>
      </UForm>
    </div>
  </UCard>
</template>
