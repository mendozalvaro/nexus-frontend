<script setup lang="ts">
import { z } from "zod";

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
}>(), {
  loading: false,
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
  });
};
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-5" @submit="submit">
    <UFormField label="Sucursal" name="branchId">
      <div
        v-if="canSwitchBranch"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
      >
        <select v-model="state.branchId" class="w-full bg-transparent outline-none" :disabled="loading">
          <option v-for="branch in branches" :key="branch.id" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>
      <div
        v-else
        class="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
      >
        {{ selectedBranchName }}
      </div>
    </UFormField>

    <div class="flex flex-wrap gap-2">
      <UButton :color="state.customerMode === 'walk_in' ? 'primary' : 'neutral'" :variant="state.customerMode === 'walk_in' ? 'solid' : 'soft'" @click="state.customerMode = 'walk_in'">
        Walk-in
      </UButton>
      <UButton :color="state.customerMode === 'existing' ? 'primary' : 'neutral'" :variant="state.customerMode === 'existing' ? 'solid' : 'soft'" @click="state.customerMode = 'existing'">
        Cliente existente
      </UButton>
    </div>

    <div v-if="state.customerMode === 'existing'" class="space-y-4">
      <UFormField label="Buscar cliente">
        <UInput v-model="state.customerQuery" icon="i-lucide-search" placeholder="Nombre, email o teléfono" :disabled="loading" />
      </UFormField>

      <UFormField label="Cliente" name="customerId">
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="state.customerId" class="w-full bg-transparent outline-none" :disabled="loading">
            <option value="">Selecciona un cliente</option>
            <option v-for="customer in customerOptions" :key="customer.id" :value="customer.id">
              {{ customer.fullName }}{{ customer.phone ? ` · ${customer.phone}` : "" }}
            </option>
          </select>
        </div>
      </UFormField>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <UFormField label="Nombre" name="walkInFullName">
        <UInput v-model="state.walkInFullName" placeholder="Cliente de mostrador" :disabled="loading" />
      </UFormField>

      <UFormField label="Teléfono" name="walkInPhone">
        <UInput v-model="state.walkInPhone" placeholder="+591 70000000" :disabled="loading" />
      </UFormField>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <UFormField label="Método de pago" name="paymentMethod">
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="state.paymentMethod" class="w-full bg-transparent outline-none" :disabled="loading">
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
            <option value="mixed">Mixto</option>
            <option value="digital_wallet">Billetera digital</option>
          </select>
        </div>
      </UFormField>

      <UFormField label="Tipo de descuento" name="discountType">
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
          <select v-model="state.discountType" class="w-full bg-transparent outline-none" :disabled="loading">
            <option value="none">Sin descuento</option>
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </div>
      </UFormField>

      <UFormField label="Valor descuento" name="discountValue" class="md:col-span-2">
        <UInput v-model.number="state.discountValue" type="number" min="0" step="0.01" :disabled="loading || state.discountType === 'none'" />
      </UFormField>
    </div>

    <UFormField label="Nota interna" name="note">
      <UTextarea v-model="state.note" :rows="3" placeholder="Referencia opcional para la venta o cobro." :disabled="loading" />
    </UFormField>

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

    <div class="flex justify-end gap-3">
      <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('cancel')">
        Cancelar
      </UButton>
      <UButton type="submit" color="primary" :loading="loading" :disabled="!state.branchId">
        Confirmar venta
      </UButton>
    </div>
  </UForm>
</template>
