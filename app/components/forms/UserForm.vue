<script setup lang="ts">
import { z } from "zod";

import type { UserBranchOption, UserMutationPayload } from "@/composables/useUsers";

type FormRole = UserMutationPayload["role"];

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
  canCreateManager: boolean;
  limitMessage?: string | null;
  assignedBranchesLabel?: string | null;
  initialValue?: Partial<UserFormModel>;
}>(), {
  loading: false,
  limitMessage: null,
  assignedBranchesLabel: null,
  initialValue: () => ({}),
});

const emits = defineEmits<{
  "update:open": [boolean];
  submit: [UserFormModel];
  assignBranches: [];
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
    state.role = props.initialValue.role ?? "employee";
    state.branchId = props.initialValue.branchId ?? null;
  },
  { immediate: true },
);

const schema = computed(() => {
  const passwordSchema =
    props.mode === "create"
      ? z.string().min(8, "La contraseña debe tener al menos 8 caracteres.")
      : z.string().optional();

  return z
    .object({
      fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
      email: z.string().trim().email("Ingresa un email válido."),
      password: passwordSchema,
      role: z.enum(["admin", "manager", "employee"] satisfies FormRole[]),
      branchId: z.string().nullable(),
    })
    .superRefine((value, ctx) => {
      if ((value.role === "manager" || value.role === "employee") && !value.branchId) {
        ctx.addIssue({
          code: "custom",
          path: ["branchId"],
          message: "Selecciona una sucursal principal para este rol.",
        });
      }

      if (value.role === "manager" && !props.canCreateManager) {
        ctx.addIssue({
          code: "custom",
          path: ["role"],
          message: "Tu plan actual no permite crear managers.",
        });
      }
    });
});

const title = computed(() => (props.mode === "create" ? "Crear usuario" : "Editar usuario"));
const description = computed(() =>
  props.mode === "create"
    ? "Crea un nuevo miembro del equipo respetando los límites del plan."
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
          title="Límite de usuarios alcanzado"
          :description="limitMessage"
        />

        <UForm :schema="schema" :state="state" class="space-y-4" @submit="emits('submit', state)">
          <UFormField label="Nombre completo" name="fullName">
            <UInput v-model="state.fullName" placeholder="Ej. María Pérez" :disabled="loading" />
          </UFormField>

          <UFormField label="Email" name="email">
            <UInput v-model="state.email" type="email" placeholder="equipo@nexuspos.com" :disabled="loading" />
          </UFormField>

          <UFormField v-if="mode === 'create'" label="Contraseña temporal" name="password">
            <UInput v-model="state.password" type="password" placeholder="Mínimo 8 caracteres" :disabled="loading" />
          </UFormField>

          <UFormField label="Rol" name="role">
            <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.role" class="w-full bg-transparent outline-none">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
            </div>
          </UFormField>

          <UFormField label="Sucursal principal" name="branchId">
            <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
              <select v-model="state.branchId" class="w-full bg-transparent outline-none">
                <option :value="null">Sin sucursal</option>
                <option v-for="branch in branches" :key="branch.value" :value="branch.value">
                  {{ branch.label }}
                </option>
              </select>
            </div>
          </UFormField>

          <div v-if="state.role === 'employee'" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-medium text-slate-950 dark:text-white">
                  Sucursales asignadas
                </p>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {{ assignedBranchesLabel ?? "Configura una o más sucursales y define una primaria." }}
                </p>
              </div>

              <UButton color="neutral" variant="soft" icon="i-lucide-building-2" :disabled="loading" @click="emits('assignBranches')">
                Asignar
              </UButton>
            </div>
          </div>

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
