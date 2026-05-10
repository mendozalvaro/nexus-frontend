# Admin CRUD Modal Template

Usa esta plantilla cuando el formulario sea un modal administrativo estándar y no un flujo con repeater complejo.

## Ficha obligatoria

- tipo: `modal CRUD`
- layout: `1 columna`, `2 columnas` o `mixto`
- ancho del modal:
  - `1 columna` => `max-w-xl`
  - `2 columnas` => `max-w-4xl`
  - `mixto` => declarar `max-w-*` según la sección dominante
- secciones: contexto, datos principales, acciones
- acciones: cancelar, secundaria opcional, submit
- transformación: `state -> payload`
- reset al cerrar: obligatorio

## Esqueleto

```vue
<script setup lang="ts">
import { z } from "zod";
import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

interface FormState {
  name: string;
  description: string;
  status: "active" | "inactive";
}

interface Payload {
  name: string;
  description: string;
  status: "active" | "inactive";
}

interface NuxtFormApi<T> {
  validate: (opts?: { nested?: boolean; silent?: boolean }) => Promise<T | false>;
  clear: (path?: string | RegExp) => void;
}

const props = defineProps<{
  open: boolean;
  title: string;
  loading?: boolean;
}>();

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [Payload];
}>();

const modalWidthClass = "max-w-4xl";

const formRef = ref<NuxtFormApi<FormState> | null>(null);

const state = reactive<FormState>({
  name: "",
  description: "",
  status: "active",
});

const schema = z.object({
  name: z.string().trim().min(3, "Ingresa un nombre."),
  description: z.string().trim().min(3, "Ingresa una descripción."),
  status: z.enum(["active", "inactive"]),
});

function resetForm() {
  state.name = "";
  state.description = "";
  state.status = "active";
  formRef.value?.clear();
}

function buildPayload(formData: FormState): Payload {
  return {
    name: formData.name.trim(),
    description: formData.description.trim(),
    status: formData.status,
  };
}

function handleOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    resetForm();
  }

  emits("update:open", nextOpen);
}

async function handleSubmit() {
  const validatedState = await formRef.value?.validate({ nested: true, silent: false });
  if (!validatedState) {
    return;
  }

  emits("submit", buildPayload(validatedState));
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.title"
    :ui="{ content: modalWidthClass }"
    @update:open="handleOpenChange"
  >
    <template #body>
      <UForm
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-6"
      >
        <AdminFormSection
          title="Datos principales"
          description="Define la información base del registro."
          :columns="2"
        >
          <AdminFieldGroup :columns="2">
            <UFormField label="Nombre" name="name">
              <UInput
                v-model="state.name"
                class="w-full"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>

            <UFormField label="Estado" name="status">
              <USelectMenu
                v-model="state.status"
                :items="[
                  { label: 'Activo', value: 'active' },
                  { label: 'Inactivo', value: 'inactive' },
                ]"
                value-key="value"
                label-key="label"
                class="w-full"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>

            <UFormField label="Descripción" name="description" class="sm:col-span-2">
              <UTextarea
                v-model="state.description"
                :rows="3"
                autoresize
                class="w-full"
                :ui="ADMIN_FIELD_UI"
              />
            </UFormField>
          </AdminFieldGroup>
        </AdminFormSection>
      </UForm>
    </template>

    <template #footer>
      <AdminFormActions>
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="handleOpenChange(false)"
        />
        <UButton
          label="Guardar"
          color="primary"
          :disabled="props.loading"
          @click="handleSubmit"
        />
      </AdminFormActions>
    </template>
  </UModal>
</template>
```

## Decisiones por layout

- `1 columna`
  - usa `max-w-xl`
  - favorece una sola `AdminFormSection`
  - ideal para texto largo o pocos campos
- `2 columnas`
  - usa `max-w-4xl`
  - usa `AdminFieldGroup :columns="2"`
  - ideal para CRUD con pares de campos cortos
- `mixto`
  - declara ancho explícito (`max-w-3xl`, `max-w-4xl`, `max-w-5xl`)
  - combina secciones de 1 y 2 columnas
  - úsalo cuando haya una cabecera contextual y luego bloques más densos
