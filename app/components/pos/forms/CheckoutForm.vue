<script setup lang="ts">
import { z } from "zod";

import AdminFieldGroup from "@/components/ui/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/components/ui/forms/AdminFormActions.vue";
import AdminFormSection from "@/components/ui/forms/AdminFormSection.vue";
import AdminReadonlyField from "@/components/ui/forms/AdminReadonlyField.vue";
import { ADMIN_FIELD_UI } from "@/utils/ui/forms";

import type {
  POSBranchOption,
  POSCheckoutPayload,
  POSCustomerOption,
} from "@/composables/usePOS";

const props = withDefaults(defineProps<{
  loading?: boolean;
  branches: POSBranchOption[];
  selectedBranchId: string;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  customerOptions: POSCustomerOption[];
  hasAppointmentContext?: boolean;
  appointmentCustomerId?: string | null;
  appointmentWalkIn?: { fullName: string; phone: string } | null;
}>(), {
  loading: false,
  hasAppointmentContext: false,
  appointmentCustomerId: null,
  appointmentWalkIn: null,
});

const emits = defineEmits<{
  submit: [POSCheckoutPayload];
  cancel: [];
  "search-customers": [string];
}>();
const { profile } = useAuth();

const state = reactive({
  branchId: props.selectedBranchId,
  customerMode: "walk_in" as "existing" | "walk_in",
  customerId: "",
  walkInFullName: "",
  walkInPhone: "",
  paymentMethod: "cash" as POSCheckoutPayload["paymentMethod"],
  discountType: "none" as POSCheckoutPayload["discount"]["type"],
  discountValue: 0,
  note: "",
  customerQuery: "",
  createAppointments: true,
});

watch(
  () => props.selectedBranchId,
  (value) => {
    state.branchId = value;
  },
  { immediate: true },
);

watch(
  () => props.branches,
  (branches) => {
    if (branches.length === 0) {
      state.branchId = "";
      return;
    }

    if (!branches.some((branch) => branch.id === state.branchId)) {
      state.branchId = branches[0]?.id ?? "";
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => state.customerQuery,
  (value) => {
    emits("search-customers", value);
  },
);

watch(
  () => props.appointmentCustomerId,
  (value) => {
    if (value) {
      state.customerMode = "existing";
      state.customerId = value;
    }
  },
  { immediate: true },
);

watch(
  () => props.appointmentWalkIn,
  (value) => {
    if (value) {
      state.customerMode = "walk_in";
      state.walkInFullName = value.fullName;
      state.walkInPhone = value.phone;
    }
  },
  { immediate: true },
);

const schema = z.object({
  branchId: z.string().uuid("Selecciona una sucursal válida."),
  customerMode: z.enum(["existing", "walk_in"]),
  customerId: z.string(),
  walkInFullName: z.string(),
  walkInPhone: z.string(),
  paymentMethod: z.enum(["cash", "card", "transfer", "mixed", "digital_wallet"]),
  discountType: z.enum(["none", "percentage", "fixed"]),
  discountValue: z.number().min(0, "El descuento no puede ser negativo."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres."),
}).superRefine((value, context) => {
  if (value.customerMode === "existing" && !value.customerId) {
    context.addIssue({
      code: "custom",
      path: ["customerId"],
      message: "Selecciona un cliente existente.",
    });
  }

  if (value.customerMode === "walk_in") {
    if (value.walkInFullName.trim().length < 3) {
      context.addIssue({
        code: "custom",
        path: ["walkInFullName"],
        message: "Ingresa el nombre del cliente walk-in.",
      });
    }

    if (value.walkInPhone.trim().length < 7) {
      context.addIssue({
        code: "custom",
        path: ["walkInPhone"],
        message: "Ingresa un teléfono válido para el walk-in.",
      });
    }
  }

  if (value.discountType === "percentage" && value.discountValue > 100) {
    context.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "El descuento porcentual no puede superar 100%.",
    });
  }
});

const canSwitchBranch = computed(() =>
  profile.value?.role === "admin" && props.branches.length > 1,
);

const selectedBranchName = computed(() =>
  props.branches.find((branch) => branch.id === state.branchId)?.name ?? "Sin sucursal",
);

const preview = computed(() => {
  const normalizedValue = state.discountType === "none" ? 0 : state.discountValue;
  const discountAmount = state.discountType === "percentage"
    ? Math.min(props.subtotal, props.subtotal * (normalizedValue / 100))
    : state.discountType === "fixed"
      ? Math.min(props.subtotal, normalizedValue)
      : 0;

  return {
    discountAmount,
    finalAmount: Math.max(0, props.subtotal - discountAmount),
  };
});

const submit = () => {
  if (!state.branchId) {
    return;
  }

  emits("submit", {
    branchId: state.branchId,
    customer: state.customerMode === "existing"
      ? {
          mode: "existing",
          customerId: state.customerId,
        }
      : {
          mode: "walk_in",
          fullName: state.walkInFullName.trim(),
          phone: state.walkInPhone.trim(),
        },
    paymentMethod: state.paymentMethod,
    discount: {
      type: state.discountType,
      value: state.discountValue,
    },
    note: state.note,
    createAppointments: state.createAppointments,
  });
};
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-5" @submit="submit">
    <AdminFormSection
      title="Contexto de venta"
      description="Define sucursal, tipo de cliente y datos comerciales del cobro."
      :columns="2"
    >
      <UFormField label="Sucursal" name="branchId">
        <USelect
          v-if="canSwitchBranch"
          v-model="state.branchId"
          :items="branches.map((branch) => ({ label: branch.name, value: branch.id }))"
          label-key="label"
          value-key="value"
          placeholder="Selecciona una sucursal"
          class="w-full"
          :disabled="loading"
          :ui="ADMIN_FIELD_UI"
        />

        <AdminReadonlyField v-else label="Sucursal" :value="selectedBranchName" />
      </UFormField>

      <div class="sm:col-span-2 flex flex-wrap gap-2">
        <UButton :color="state.customerMode === 'walk_in' ? 'primary' : 'neutral'" :variant="state.customerMode === 'walk_in' ? 'solid' : 'soft'" @click="state.customerMode = 'walk_in'">
          Walk-in
        </UButton>
        <UButton :color="state.customerMode === 'existing' ? 'primary' : 'neutral'" :variant="state.customerMode === 'existing' ? 'solid' : 'soft'" @click="state.customerMode = 'existing'">
          Cliente existente
        </UButton>
      </div>

      <template v-if="state.customerMode === 'existing'">
        <UFormField label="Buscar cliente">
          <UInput v-model="state.customerQuery" icon="i-lucide-search" placeholder="Nombre, email o teléfono" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Cliente" name="customerId">
          <USelect
            v-model="state.customerId"
            :items="customerOptions.map(c => ({ label: `${c.fullName}${c.phone ? ` · ${c.phone}` : ''}`, value: c.id }))"
            label-key="label"
            value-key="value"
            placeholder="Selecciona un cliente"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>
      </template>

      <AdminFieldGroup v-else :columns="2" class="sm:col-span-2">
        <UFormField label="Nombre" name="walkInFullName">
          <UInput v-model="state.walkInFullName" placeholder="Cliente de mostrador" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Teléfono" name="walkInPhone">
          <UInput v-model="state.walkInPhone" placeholder="+591 70000000" :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>
      </AdminFieldGroup>
    </AdminFormSection>

    <AdminFormSection
      title="Cobro"
      description="Selecciona método de pago, descuento y notas internas de la operación."
      :columns="2"
    >
      <AdminFieldGroup :columns="2" class="sm:col-span-2">
        <UFormField label="Método de pago" name="paymentMethod">
          <USelect
            v-model="state.paymentMethod"
            :items="[
              { label: 'Efectivo', value: 'cash' },
              { label: 'Tarjeta', value: 'card' },
              { label: 'Transferencia', value: 'transfer' },
              { label: 'Mixto', value: 'mixed' },
              { label: 'Billetera digital', value: 'digital_wallet' },
            ]"
            label-key="label"
            value-key="value"
            placeholder="Método de pago"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Tipo de descuento" name="discountType">
          <USelect
            v-model="state.discountType"
            :items="[
              { label: 'Sin descuento', value: 'none' },
              { label: 'Porcentaje', value: 'percentage' },
              { label: 'Monto fijo', value: 'fixed' },
            ]"
            label-key="label"
            value-key="value"
            placeholder="Tipo de descuento"
            class="w-full"
            :disabled="loading"
            :ui="ADMIN_FIELD_UI"
          />
        </UFormField>

        <UFormField label="Valor descuento" name="discountValue" class="sm:col-span-2">
          <UInput v-model.number="state.discountValue" type="number" min="0" step="0.01" :disabled="loading || state.discountType === 'none'" class="w-full" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <UFormField label="Nota interna" name="note" class="sm:col-span-2">
          <UTextarea v-model="state.note" :rows="4" placeholder="Referencia opcional para la venta o cobro." :disabled="loading" :ui="ADMIN_FIELD_UI" />
        </UFormField>

        <div class="sm:col-span-2 flex items-center gap-2">
          <UCheckbox
            v-model="state.createAppointments"
            :label="props.hasAppointmentContext ? 'Cita ya agendada (se vinculara al cobro)' : 'Agendar servicios en calendario'"
            :disabled="loading || props.hasAppointmentContext"
          />
        </div>
      </AdminFieldGroup>
    </AdminFormSection>

    <div class="rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-900/80">
      <div class="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Subtotal</span>
        <span>Bs {{ subtotal.toFixed(2) }}</span>
      </div>
      <div class="mt-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Descuento</span>
        <span>Bs {{ preview.discountAmount.toFixed(2) }}</span>
      </div>
      <div class="mt-4 flex items-center justify-between text-lg font-semibold text-slate-950 dark:text-white">
        <span>Total final</span>
        <span>Bs {{ preview.finalAmount.toFixed(2) }}</span>
      </div>
    </div>

    <AdminFormActions>
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading" :disabled="!state.branchId">
        Confirmar venta
      </UButton>
    </AdminFormActions>
  </UForm>
</template>
