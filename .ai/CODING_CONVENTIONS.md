# 📝 Convenciones de Código - NexusPOS

## TypeScript Configuration

- Strict mode: ACTIVADO en tsconfig.json
- Usar interfaces generadas: `import type { Database } from '@/types/supabase'`
- Evitar `any`. Usar `unknown` + type guards si es necesario
- Generar tipos con: `supabase gen types typescript --local > types/supabase.ts`

## Nuxt 4.4.2 Conventions

## Componentes Vue 3 (Composition API)

```vue
<script setup lang="ts">
// Props tipadas con interface
interface Props {
  appointment: Database["public"]["Tables"]["appointments"]["Row"];
  isLoading?: boolean;
  editable?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  editable: false,
});

// Emits tipados
const emit = defineEmits<{
  (e: "update", id: string): void;
  (e: "cancel", id: string): void;
  (e: "error", message: string): void;
}>();

// Estados reactivos
const isSubmitting = ref(false);
const error = ref<string | null>(null);

// Funciones
const handleSubmit = async () => {
  isSubmitting.value = true;
  error.value = null;
  try {
    // lógica...
  } catch (err) {
    error.value = "Ocurrió un error";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <UCard>
    <UButton
      :loading="isSubmitting"
      :disabled="!editable"
      @click="handleSubmit"
    >
      Guardar
    </UButton>

    <UAlert v-if="error" color="red" :title="error" />
  </UCard>
</template>
```

````

## Composables Pattern Estándar

```typescript
// composables/useAppointments.ts
export const useAppointments = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseSession();

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const fetchAppointments = async (
    filters: {
      branchId?: string;
      employeeId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string[];
    } = {},
  ) => {
    if (!user.value) return [];

    isLoading.value = true;
    error.value = null;

    try {
      const orgId = user.value.user_metadata?.organization_id;
      let query = supabase
        .from("appointments")
        .select(
          `
          *,
          employee:profiles(full_name, avatar_url),
          service:services(name, duration_minutes)
        `,
        )
        .eq("organization_id", orgId);

      // Aplicar filtros dinámicos
      if (filters.branchId) query = query.eq("branch_id", filters.branchId);
      if (filters.employeeId)
        query = query.eq("employee_id", filters.employeeId);
      if (filters.status?.length) query = query.in("status", filters.status);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      return data || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Error desconocido";
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    fetchAppointments,
  };
};
```

## Nombres de Variables (Consistencia)

```typescript
// Estados booleanos de UI
(isLoading, isSubmitting, isDisabled, isVisible, isExpanded);

// Resultados de queries a Supabase
(data, error, pending, status("pending" | "success" | "error"));

// Event handlers (prefijo on/ handle)
(handleClick, onSubmit, onCancel, onSave, onEdit, onDelete);

// Datos de negocio (plural para listas, singular para ítems)
(appointments, appointment, transactions, transaction, products, product);

// IDs y referencias
(orgId, branchId, userId, appointmentId, transactionId);
```

## Estilos con Tailwind + Nuxt UI

```vue
<!-- ✅ CORRECTO -->
<template>
  <div class="p-4 space-y-4">
    <UButton color="primary" icon="i-heroicons-plus" @click="openModal">
      Nueva Cita
    </UButton>

    <UTable
      :rows="appointments"
      :columns="columns"
      :loading="isLoading"
      class="w-full"
    />

    <UModal v-model="isModalOpen">
      <!-- contenido -->
    </UModal>
  </div>
</template>

<!-- ❌ EVITAR: Estilos inline complejos -->
<template>
  <div style="padding: 16px; display: flex; gap: 12px;">
    <!-- mejor usar clases Tailwind -->
  </div>
</template>
```

## Imports y Aliases

```typescript
// ✅ CORRECTO - Usar alias @ para imports absolutos
import { useAppointments } from "@/composables/useAppointments";
import type { Appointment } from "@/types/supabase";
import AppointmentCard from "@/components/features/AppointmentCard.vue";

// ❌ INCORRECTO - Relative paths profundos
import { useAppointments } from "../../../composables/useAppointments";
```

## Manejo de Fechas y Timezones

```typescript
// ✅ Usar timezone de la organización (guardado en DB)
const timezone = user.value?.user_metadata?.timezone || "UTC";

// Formatear para mostrar al usuario
const formatDate = (date: string) => {
  return new Date(date).toLocaleString("es-PE", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// Enviar a DB en UTC (Supabase maneja timestamptz)
const saveAppointment = async (localDate: Date) => {
  await supabase.from("appointments").insert({
    start_time: localDate.toISOString(), // ← UTC automático
    // ...
  });
};
```
````
