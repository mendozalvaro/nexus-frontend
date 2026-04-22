<script setup lang="ts">
import UserForm from "@/components/forms/UserForm.vue";
import UserTable from "@/components/users/UserTable.vue";
import UserAssignByRoleModal from "@/components/users/UserAssignByRoleModal.vue";

import type { UserListRow, UserMutationPayload } from "@/composables/useUsers";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "users.view",
  roles: ["admin", "manager"],
});

const { profile } = useAuth();
const {
  statusOptions,
  getDefaultFilters,
  loadUsers,
  createUser,
  updateUser,
  deactivateUser,
  userLimitMessage,
  canCreateMoreUsers,
  isOverUserLimit,
  capabilities,
} = useUsers();

const filters = reactive(getDefaultFilters());
const activeTab = ref<"summary" | "users" | "assignments">("summary");
const userModalOpen = ref(false);
const mutationLoading = ref(false);
const actionError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);
const editingUser = ref<UserListRow | null>(null);
const createDraft = ref<{ role: "manager" | "employee"; branchId: string | null; lockRole: boolean } | null>(null);

const assignByRoleModalOpen = ref(false);
const assignByRoleDraft = ref<{ role: "manager" | "employee"; branchId: string } | null>(null);

const { data, pending, refresh } = await useAsyncData(
  "users-module",
  () => loadUsers(),
  { server: false },
);

const users = computed(() => data.value?.users ?? []);
const branchOptions = computed(() => data.value?.branches ?? []);

const actorRole = computed<"admin" | "manager">(() =>
  profile.value?.role === "manager" ? "manager" : "admin",
);

const canCreateManager = computed(() => capabilities.value?.canCreateManager ?? false);
const canAssignManager = computed(() => actorRole.value === "admin");

const branchFilterOptions = computed(() => [
  { label: "Todas las sucursales", value: "__all__" },
  ...branchOptions.value.map((branch) => ({ label: branch.label, value: branch.value })),
]);

const statusFilterOptions = computed(() =>
  statusOptions.map((status) => ({
    label: status.label,
    value: status.value,
  })),
);

const branchFilterModel = computed<string>({
  get: () => filters.branchId ?? "__all__",
  set: (value) => {
    filters.branchId = value === "__all__" ? null : value;
  },
});

const filteredUsers = computed(() => {
  const query = filters.search.trim().toLowerCase();

  return users.value.filter((row) => {
    if (row.role === "admin") {
      return false;
    }

    if (filters.status === "active" && !row.isActive) {
      return false;
    }

    if (filters.status === "inactive" && row.isActive) {
      return false;
    }

    if (filters.branchId && row.branchId !== filters.branchId) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [row.fullName, row.email, row.branchName ?? "", row.role]
      .some((value) => value.toLowerCase().includes(query));
  });
});

const summary = computed(() => {
  const nonAdminUsers = users.value.filter((user) => user.role !== "admin");
  const total = nonAdminUsers.length;
  const active = nonAdminUsers.filter((user) => user.isActive).length;
  const inactive = total - active;
  const managers = nonAdminUsers.filter((user) => user.role === "manager").length;
  const employees = nonAdminUsers.filter((user) => user.role === "employee").length;

  return { total, active, inactive, managers, employees };
});

const assignmentsTree = computed(() =>
  branchOptions.value.map((branch) => {
    const managers = users.value.filter(
      (user) => user.role === "manager" && user.branchId === branch.value,
    );

    const employees = users.value.filter((user) => {
      if (user.role !== "employee") {
        return false;
      }

      return (
        user.branchId === branch.value
        || user.assignedBranches.some((assignment) => assignment.branchId === branch.value)
      );
    });

    return {
      branch,
      managers,
      employees,
    };
  }),
);

const assignByRoleOptions = computed(() => {
  if (!assignByRoleDraft.value) {
    return [] as Array<{ label: string; value: string }>;
  }

  const { role, branchId } = assignByRoleDraft.value;

  return users.value
    .filter((user) => user.isActive && user.role === role)
    .filter((user) => {
      if (role === "manager") {
        return user.branchId !== branchId;
      }

      return !(
        user.branchId === branchId
        || user.assignedBranches.some((assignment) => assignment.branchId === branchId)
      );
    })
    .map((user) => ({
      label: `${user.fullName} (${user.email})`,
      value: user.id,
    }));
});

const hasAssignableUsers = (role: "manager" | "employee", branchId: string) => {
  return users.value.some((user) => {
    if (!user.isActive || user.role !== role) {
      return false;
    }

    if (role === "manager") {
      return user.branchId !== branchId;
    }

    return !(
      user.branchId === branchId
      || user.assignedBranches.some((assignment) => assignment.branchId === branchId)
    );
  });
};

const openCreateUser = (draft?: { role?: "manager" | "employee"; branchId?: string | null; lockRole?: boolean }) => {
  editingUser.value = null;
  createDraft.value = {
    role: draft?.role ?? "employee",
    branchId: draft?.branchId ?? null,
    lockRole: Boolean(draft?.lockRole),
  };

  actionError.value = null;
  actionSuccess.value = null;
  userModalOpen.value = true;
};

const openEditUser = (user: UserListRow) => {
  editingUser.value = user;
  createDraft.value = null;
  actionError.value = null;
  actionSuccess.value = null;
  userModalOpen.value = true;
};

const openAssignByRole = (role: "manager" | "employee", branchId: string) => {
  assignByRoleDraft.value = { role, branchId };
  assignByRoleModalOpen.value = true;
  actionError.value = null;
  actionSuccess.value = null;
};

const toPayload = (input: {
  fullName: string;
  email: string;
  password: string;
  role: UserMutationPayload["role"];
  branchId: string | null;
}): UserMutationPayload => {
  if (input.role !== "employee") {
    return {
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      branchId: input.branchId,
      assignedBranchIds: [],
      primaryBranchId: input.branchId,
      password: input.password || undefined,
    };
  }

  const currentAssignedBranchIds = editingUser.value?.assignedBranches.map((assignment) => assignment.branchId) ?? [];
  const mergedBranchIds = Array.from(
    new Set([
      ...(input.branchId ? [input.branchId] : []),
      ...currentAssignedBranchIds,
    ]),
  );

  const currentPrimaryBranchId = editingUser.value?.assignedBranches.find((assignment) => assignment.isPrimary)?.branchId
    ?? editingUser.value?.branchId
    ?? null;

  const normalizedPrimaryBranchId = currentPrimaryBranchId && mergedBranchIds.includes(currentPrimaryBranchId)
    ? currentPrimaryBranchId
    : (input.branchId ?? mergedBranchIds[0] ?? null);

  return {
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    branchId: input.branchId,
    assignedBranchIds: mergedBranchIds,
    primaryBranchId: normalizedPrimaryBranchId,
    password: input.password || undefined,
  };
};

const handleSubmitUser = async (input: {
  fullName: string;
  email: string;
  password: string;
  role: UserMutationPayload["role"];
  branchId: string | null;
}) => {
  actionError.value = null;
  actionSuccess.value = null;
  mutationLoading.value = true;

  try {
    const payload = toPayload(input);

    if (editingUser.value) {
      await updateUser(editingUser.value.id, payload);
      actionSuccess.value = "Usuario actualizado correctamente.";
    } else {
      await createUser(payload);
      actionSuccess.value = "Usuario creado correctamente.";
    }

    userModalOpen.value = false;
    editingUser.value = null;
    createDraft.value = null;
    await refresh();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "No se pudo completar la operacion.";
  } finally {
    mutationLoading.value = false;
  }
};

const handleAssignByRoleSubmit = async (userId: string) => {
  if (!assignByRoleDraft.value) {
    return;
  }

  const selectedUser = users.value.find((user) => user.id === userId);
  if (!selectedUser) {
    actionError.value = "No se encontro el usuario seleccionado.";
    return;
  }

  const { role, branchId } = assignByRoleDraft.value;

  const payload: UserMutationPayload = role === "manager"
    ? {
        fullName: selectedUser.fullName,
        email: selectedUser.email,
        role: "manager",
        branchId,
        assignedBranchIds: [],
        primaryBranchId: branchId,
      }
    : (() => {
        const existingIds = selectedUser.assignedBranches.map((assignment) => assignment.branchId);
        const nextAssignedIds = Array.from(new Set([
          ...existingIds,
          ...(selectedUser.branchId ? [selectedUser.branchId] : []),
          branchId,
        ]));

        const nextPrimary = selectedUser.assignedBranches.find((assignment) => assignment.isPrimary)?.branchId
          ?? selectedUser.branchId
          ?? branchId;

        return {
          fullName: selectedUser.fullName,
          email: selectedUser.email,
          role: "employee",
          branchId: selectedUser.branchId ?? branchId,
          assignedBranchIds: nextAssignedIds,
          primaryBranchId: nextPrimary,
        };
      })();

  actionError.value = null;
  actionSuccess.value = null;
  mutationLoading.value = true;

  try {
    await updateUser(selectedUser.id, payload);
    actionSuccess.value = "Asignacion actualizada correctamente.";
    assignByRoleModalOpen.value = false;
    assignByRoleDraft.value = null;
    await refresh();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "No se pudo actualizar la asignacion.";
  } finally {
    mutationLoading.value = false;
  }
};

const handleDeactivateUser = async (user: UserListRow) => {
  actionError.value = null;
  actionSuccess.value = null;

  const accepted = globalThis.confirm(`Se desactivara el usuario ${user.fullName}. Deseas continuar?`);
  if (!accepted) {
    return;
  }

  mutationLoading.value = true;
  try {
    await deactivateUser(user.id);
    actionSuccess.value = "Usuario desactivado correctamente.";
    await refresh();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "No se pudo desactivar el usuario.";
  } finally {
    mutationLoading.value = false;
  }
};

const clearFilters = () => {
  Object.assign(filters, getDefaultFilters());
};
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UAlert
      v-if="isOverUserLimit"
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="La organizacion excede el limite de usuarios del plan"
      :description="userLimitMessage ?? undefined"
    />

    <UAlert
      v-if="actionError"
      color="error"
      variant="soft"
      icon="i-lucide-circle-x"
      title="No se pudo completar la operacion"
      :description="actionError"
    />

    <UAlert
      v-if="actionSuccess"
      color="success"
      variant="soft"
      icon="i-lucide-circle-check"
      :title="actionSuccess"
    />

    <div class="flex flex-wrap gap-2">
      <UButton :variant="activeTab === 'summary' ? 'solid' : 'soft'" :color="activeTab === 'summary' ? 'primary' : 'neutral'" @click="activeTab = 'summary'">
        Resumen
      </UButton>
      <UButton :variant="activeTab === 'users' ? 'solid' : 'soft'" :color="activeTab === 'users' ? 'primary' : 'neutral'" @click="activeTab = 'users'">
        Usuarios
      </UButton>
      <UButton :variant="activeTab === 'assignments' ? 'solid' : 'soft'" :color="activeTab === 'assignments' ? 'primary' : 'neutral'" @click="activeTab = 'assignments'">
        Asignaciones
      </UButton>
    </div>

    <div v-if="activeTab === 'summary'" class="space-y-4">
      <UiModuleHero
        eyebrow="Administracion"
        title="Usuarios"
        description="Gestiona equipo, roles y acceso por sucursal desde un solo modulo operativo."
        icon="i-lucide-users"
      />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <UiStatCard label="Usuarios" :value="summary.total" icon="i-lucide-users" icon-class="text-sky-600 dark:text-sky-300" icon-wrapper-class="bg-sky-100 dark:bg-sky-950/50" />
        <UiStatCard label="Activos" :value="summary.active" icon="i-lucide-badge-check" icon-class="text-emerald-600 dark:text-emerald-300" icon-wrapper-class="bg-emerald-100 dark:bg-emerald-950/50" />
        <UiStatCard label="Inactivos" :value="summary.inactive" icon="i-lucide-power-off" icon-class="text-slate-600 dark:text-slate-300" icon-wrapper-class="bg-slate-100 dark:bg-slate-900/60" />
        <UiStatCard label="Managers" :value="summary.managers" icon="i-lucide-user-cog" icon-class="text-amber-600 dark:text-amber-300" icon-wrapper-class="bg-amber-100 dark:bg-amber-950/50" />
        <UiStatCard label="Employees" :value="summary.employees" icon="i-lucide-user-round" icon-class="text-indigo-600 dark:text-indigo-300" icon-wrapper-class="bg-indigo-100 dark:bg-indigo-950/50" />
      </div>
    </div>

    <template v-if="activeTab === 'users'">
      <div class="flex justify-end">
        <UButton color="primary" icon="i-lucide-user-plus" :disabled="!canCreateMoreUsers" @click="openCreateUser()">
          Nuevo usuario
        </UButton>
      </div>

      <UiSearchFilters title="Filtrar usuarios" description="Busca por nombre/email y filtra por sucursal y estado." surface>
        <template #controls>
          <div class="grid grid-cols-1 gap-3 xl:grid-cols-4">
            <UInput
              v-model="filters.search"
              icon="i-lucide-search"
              placeholder="Buscar usuario..."
              :ui="{ base: 'min-h-11 text-base' }"
              class="xl:col-span-2"
            />

            <USelect
              v-model="branchFilterModel"
              :items="branchFilterOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />

            <USelect
              v-model="filters.status"
              :items="statusFilterOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </div>
        </template>

        <template #summary>
          {{ filteredUsers.length }} usuario(s)
        </template>

        <template #actions>
          <UButton color="neutral" variant="soft" @click="clearFilters">
            Limpiar filtros
          </UButton>
        </template>
      </UiSearchFilters>

      <UserTable
        :rows="filteredUsers"
        :loading="pending || mutationLoading"
        :actor-role="actorRole"
        @edit="openEditUser"
        @deactivate="handleDeactivateUser"
      />
    </template>

    <div v-if="activeTab === 'assignments'" class="space-y-4">
      <UAlert
        v-if="assignmentsTree.length === 0"
        color="warning"
        variant="soft"
        icon="i-lucide-triangle-alert"
        title="No hay sucursales activas"
        description="Activa o crea una sucursal para gestionar asignaciones de equipo."
      />

      <UCard
        v-for="node in assignmentsTree"
        :key="node.branch.value"
        class="rounded-[1.5rem] border border-slate-200/80 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20"
      >
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Sucursal activa
              </p>
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                {{ node.branch.label }}
              </h3>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="sm"
                color="warning"
                variant="soft"
                icon="i-lucide-user-cog"
                :disabled="!canAssignManager || !hasAssignableUsers('manager', node.branch.value)"
                @click="openAssignByRole('manager', node.branch.value)"
              >
                Anadir manager
              </UButton>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-lucide-user-plus"
                :disabled="!hasAssignableUsers('employee', node.branch.value)"
                @click="openAssignByRole('employee', node.branch.value)"
              >
                Anadir empleado
              </UButton>
            </div>
          </div>
        </template>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Managers
            </p>
            <ul class="mt-3 space-y-2">
              <li v-for="manager in node.managers" :key="manager.id" class="rounded-xl bg-white p-3 text-sm dark:bg-slate-950">
                <p class="font-medium text-slate-900 dark:text-white">
                  {{ manager.fullName }}
                </p>
                <p class="text-slate-500 dark:text-slate-400">
                  {{ manager.email }}
                </p>
              </li>
              <li v-if="node.managers.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                Sin managers asignados.
              </li>
            </ul>
          </div>

          <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Empleados
            </p>
            <ul class="mt-3 space-y-2">
              <li v-for="employee in node.employees" :key="employee.id" class="rounded-xl bg-white p-3 text-sm dark:bg-slate-950">
                <p class="font-medium text-slate-900 dark:text-white">
                  {{ employee.fullName }}
                </p>
                <p class="text-slate-500 dark:text-slate-400">
                  {{ employee.email }}
                </p>
              </li>
              <li v-if="node.employees.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                Sin empleados asignados.
              </li>
            </ul>
          </div>
        </div>
      </UCard>
    </div>

    <UserForm
      :open="userModalOpen"
      :mode="editingUser ? 'edit' : 'create'"
      :branches="branchOptions"
      :loading="mutationLoading"
      :actor-role="actorRole"
      :can-create-manager="canCreateManager"
      :forced-role="editingUser ? null : (createDraft?.lockRole ? createDraft.role : null)"
      :limit-message="editingUser ? null : userLimitMessage"
      :initial-value="editingUser
        ? {
            fullName: editingUser.fullName,
            email: editingUser.email,
            role: editingUser.role === 'manager' ? 'manager' : 'employee',
            branchId: editingUser.branchId,
          }
        : {
            role: createDraft?.role ?? 'employee',
            branchId: createDraft?.branchId ?? null,
          }"
      @update:open="userModalOpen = $event"
      @submit="handleSubmitUser"
    />

    <UserAssignByRoleModal
      :open="assignByRoleModalOpen"
      :role="assignByRoleDraft?.role ?? null"
      :branch-label="branchOptions.find((branch) => branch.value === assignByRoleDraft?.branchId)?.label ?? 'Sucursal'"
      :items="assignByRoleOptions"
      :loading="mutationLoading"
      @update:open="assignByRoleModalOpen = $event"
      @submit="handleAssignByRoleSubmit"
    />
  </div>
</template>
