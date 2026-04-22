<script setup lang="ts">
import { z } from "zod";

import type { UserBranchOption } from "@/composables/useUsers";

type FormRole = "manager" | "employee";

interface UserFormModel {
  fullName: string;
  email: string;
  password: string;
  role: FormRole;
  branchId: string | null;
}

const props = withDefaults(defineProps<{
  open: boolean;
  mode: "create" | "edit";
  branches: UserBranchOption[];
  loading?: boolean;
  actorRole?: "admin" | "manager";
  canCreateManager: boolean;
  forcedRole?: FormRole | null;
  limitMessage?: string | null;
  initialValue?: Partial<UserFormModel>;
}>(), {
  loading: false,
  actorRole: "admin",
  forcedRole: null,
  limitMessage: null,
  initialValue: () => ({}),
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [UserFormModel];
}>();

const state = reactive<UserFormModel>({
  fullName: "",
  email: "",
  password: "",
  role: "employee",
  branchId: null,
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    state.fullName = props.initialValue.fullName ?? "";
    state.email = props.initialValue.email ?? "";
    state.password = "";
    state.role = props.forcedRole ?? props.initialValue.role ?? "employee";
    state.branchId = props.initialValue.branchId ?? null;
  },
  { immediate: true },
);

const schema = computed(() => {
  const passwordSchema =
    props.mode === "create"
      ? z.string().min(8, "La contrasena debe tener al menos 8 caracteres.")
      : z.string().optional();

  return z
    .object({
      fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
      email: z.string().trim().email("Ingresa un email valido."),
      password: passwordSchema,
      role: z.enum(["manager", "employee"] satisfies FormRole[]),
      branchId: z.string().nullable(),
    })
    .superRefine((value, ctx) => {
      if (
        value.role === "manager"
        && !props.canCreateManager
        && props.initialValue.role !== "manager"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["role"],
          message: "Tu plan actual no permite crear managers.",
        });
      }

      if (props.actorRole === "manager" && value.role !== "employee") {
        ctx.addIssue({
          code: "custom",
          path: ["role"],
          message: "Un manager solo puede gestionar usuarios employee.",
        });
      }

      if (props.forcedRole && value.role !== props.forcedRole) {
        ctx.addIssue({
          code: "custom",
          path: ["role"],
          message: "El rol seleccionado no es valido para esta accion.",
        });
      }
    });
});

type RoleOption = {
  label: string;
  value: FormRole;
  disabled?: boolean;
};

const roleOptions = computed<RoleOption[]>(() => {
  if (props.forcedRole) {
    return [{
      label: props.forcedRole === "manager" ? "Manager" : "Employee",
      value: props.forcedRole,
    }];
  }

  if (props.actorRole === "manager") {
    return [{ label: "Employee", value: "employee" as const }];
  }

  return [
    { label: "Manager", value: "manager" as const, disabled: !props.canCreateManager && props.initialValue.role !== "manager" },
    { label: "Employee", value: "employee" as const },
  ];
});

const branchOptions = computed(() =>
  [
    { label: "Sin sucursal principal", value: "__none__" },
    ...props.branches.map((branch) => ({
      label: branch.label,
      value: branch.value,
    })),
  ],
);

const branchModel = computed<string>({
  get: () => state.branchId ?? "__none__",
  set: (value) => {
    state.branchId = value === "__none__" ? null : value;
  },
});

const title = computed(() => (props.mode === "create" ? "Crear usuario" : "Editar usuario"));
const description = computed(() =>
  props.mode === "create"
    ? "Crea un nuevo miembro del equipo respetando los limites del plan."
    : "Actualiza nombre, email, rol y sucursal principal del usuario.",
);
</script>

<template>
  <UModal :open="open" :title="title" :description="description" @update:open="emits('update:open', $event)">
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="limitMessage && mode === 'create'"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Limite de usuarios alcanzado"
          :description="limitMessage"
        />

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="emits('submit', state)">
          <UFormField label="Nombre completo" name="fullName">
            <UInput v-model="state.fullName" placeholder="Ej. Maria Perez" :disabled="loading" />
          </UFormField>

          <UFormField label="Email" name="email">
            <UInput v-model="state.email" type="email" placeholder="equipo@nexuspos.com" :disabled="loading" />
          </UFormField>

          <UFormField v-if="mode === 'create'" label="Contrasena temporal" name="password">
            <UInput v-model="state.password" type="password" placeholder="Minimo 8 caracteres" :disabled="loading" />
          </UFormField>

          <UFormField label="Rol" name="role">
            <USelect
              v-model="state.role"
              :items="roleOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Sucursal principal" name="branchId">
            <USelect
              v-model="branchModel"
              :items="branchOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona una sucursal"
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="loading" @click="emits('update:open', false)">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="loading" :disabled="Boolean(limitMessage) && mode === 'create'">
              {{ mode === "create" ? "Crear usuario" : "Guardar cambios" }}
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
