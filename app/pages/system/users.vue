<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

import ClientTable from "@/components/system/ClientTable.vue";
import OrgUserTable from "@/components/system/OrgUserTable.vue";
import SystemUserTable from "@/components/system/SystemUserTable.vue";
import { useSystemAdmin } from "@/composables/useSystemAdmin";
import type {
    ClientUser,
    OrganizationUser,
    SystemUserFormInput,
    SystemUserRow,
} from "@/composables/useSystemAdmin";

definePageMeta({
    middleware: ["system-only"],
    title: "System Users",
});

const {
    systemUsers,
    totalSystemUsers,
    orgUsers,
    totalOrgUsers,
    clients,
    totalClients,
    usersLoading,
    orgUsersLoading,
    clientsLoading,
    actionLoading,
    error,
    loadSystemUsers,
    loadOrgUsers,
    loadClients,
    createSystemUser,
    updateSystemUser,
    toggleSystemUserStatus,
    parsePermissions,
} = useSystemAdmin();
const currentUser = useSupabaseUser();

const systemUserPage = ref(1);
const orgUserPage = ref(1);
const clientPage = ref(1);
const perPage = 10;
const orgUsersLoaded = ref(false);
const clientsLoaded = ref(false);

const selectedUser = ref<SystemUserRow | null>(null);
const formState = reactive({
    email: "",
    fullName: "",
    password: "",
    confirmPassword: "",
    role: "system",
    permissionsJson: "[]",
});
const formError = ref<string | null>(null);
const selfDeactivateAlert = ref<string | null>(null);

const isEditing = computed(() => Boolean(selectedUser.value));
const systemUserPageCount = computed(() =>
    Math.max(1, Math.ceil(totalSystemUsers.value / perPage)),
);
const orgUserPageCount = computed(() =>
    Math.max(1, Math.ceil(totalOrgUsers.value / perPage)),
);
const clientPageCount = computed(() =>
    Math.max(1, Math.ceil(totalClients.value / perPage)),
);

interface GroupedOrganizationUsers {
    org: { id: string; name: string };
    adminUsers: OrganizationUser[];
    dependentUsers: OrganizationUser[];
}

const groupedOrgUsers = computed<GroupedOrganizationUsers[]>(() => {
    const groups: Record<string, GroupedOrganizationUsers> = {};

    orgUsers.value.forEach((user) => {
        if (!groups[user.organization_id]) {
            groups[user.organization_id] = {
                org: { id: user.organization_id, name: user.organization_name },
                adminUsers: [],
                dependentUsers: [],
            };
        }

        if (user.role === "admin") {
            groups[user.organization_id]!.adminUsers.push(user);
            return;
        }

        groups[user.organization_id]!.dependentUsers.push(user);
    });

    return Object.values(groups).map((group) => ({
        ...group,
        adminUsers: group.adminUsers.sort((a, b) =>
            a.full_name.localeCompare(b.full_name),
        ),
        dependentUsers: group.dependentUsers.sort((a, b) => {
            const roleOrder: Record<string, number> = { manager: 0, employee: 1 };
            const diff = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
            if (diff !== 0) {
                return diff;
            }

            return a.full_name.localeCompare(b.full_name);
        }),
    }));
});

const isSystemUserModalOpen = ref(false);

const setFormFromUser = (user: SystemUserRow) => {
    selectedUser.value = user;
    formState.email = user.email ?? "";
    formState.fullName = user.full_name ?? "";
    formState.password = "";
    formState.confirmPassword = "";
    formState.role = user.role;
    formState.permissionsJson = JSON.stringify(user.permissions ?? [], null, 2);
    isSystemUserModalOpen.value = true;
};

const resetForm = () => {
    selectedUser.value = null;
    formState.email = "";
    formState.fullName = "";
    formState.password = "";
    formState.confirmPassword = "";
    formState.role = "system";
    formState.permissionsJson = "[]";
    formError.value = null;
};

const openCreateModal = () => {
    resetForm();
    isSystemUserModalOpen.value = true;
};

const closeModal = () => {
    isSystemUserModalOpen.value = false;
    resetForm();
};

const saveUser = async () => {
    formError.value = null;

    if (!formState.fullName.trim()) {
        formError.value = "El nombre completo es obligatorio.";
        return;
    }

    if (!formState.email.trim()) {
        formError.value = "El email es obligatorio.";
        return;
    }

    if (!isEditing.value && !formState.password.trim()) {
        formError.value = "La contraseña es obligatoria para crear usuarios.";
        return;
    }

    if (formState.password || formState.confirmPassword) {
        if (formState.password.length < 8) {
            formError.value = "La contraseña debe tener al menos 8 caracteres.";
            return;
        }

        if (formState.password !== formState.confirmPassword) {
            formError.value = "La confirmacion de contraseña no coincide.";
            return;
        }
    }

    let permissions: SystemUserFormInput["permissions"];
    try {
        permissions = parsePermissions(formState.permissionsJson);
    } catch {
        formError.value = "Permisos invalidos. Usa JSON valido.";
        return;
    }

    const payload: SystemUserFormInput = {
        userId: selectedUser.value?.user_id,
        email: formState.email.trim(),
        fullName: formState.fullName.trim(),
        password: formState.password.trim() || null,
        role: formState.role,
        permissions,
        isActive: selectedUser.value?.is_active ?? true,
    };

    try {
        if (isEditing.value) {
            await updateSystemUser(payload);
        } else {
            await createSystemUser(payload);
        }

        closeModal();
    } catch (saveError) {
        formError.value =
            saveError instanceof Error
                ? saveError.message
                : "No pudimos guardar el usuario.";
    }
};

const loadSystemUserPage = async (page: number) => {
    if (
        page === systemUserPage.value &&
        systemUsers.value.length > 0 &&
        !usersLoading.value
    ) {
        return;
    }

    systemUserPage.value = page;
    await loadSystemUsers(page, perPage);
};

const loadOrgUserPage = async (page: number) => {
    if (
        page === orgUserPage.value &&
        orgUsersLoaded.value &&
        !orgUsersLoading.value
    ) {
        return;
    }

    orgUserPage.value = page;
    await loadOrgUsers(page, perPage);
    orgUsersLoaded.value = true;
};

const loadClientPage = async (page: number) => {
    if (
        page === clientPage.value &&
        clientsLoaded.value &&
        !clientsLoading.value
    ) {
        return;
    }

    clientPage.value = page;
    await loadClients(page, perPage);
    clientsLoaded.value = true;
};

const handleBlockOrgUser = async (user: OrganizationUser) => {
    console.log("Block org user:", user.id);
};

const handleResetOrgUserPassword = async (user: OrganizationUser) => {
    console.log("Reset password for org user:", user.id);
};

const handleBlockClient = async (user: ClientUser) => {
    console.log("Block client:", user.id);
};

const handleResetClientPassword = async (user: ClientUser) => {
    console.log("Reset password for client:", user.id);
};

const handleToggleSystemUser = async (user: SystemUserRow) => {
  if (currentUser.value?.id === user.user_id && user.is_active) {
    selfDeactivateAlert.value = "No puedes desactivar tu propio usuario.";
    return;
  }

  selfDeactivateAlert.value = null;
  await toggleSystemUserStatus(user.user_id, !user.is_active);
};

onMounted(async () => {
    await loadSystemUserPage(systemUserPage.value);
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p class="text-sm uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">System</p>
                <h1 class="text-3xl font-bold text-slate-950 dark:text-white">Gestion de usuarios</h1>
                <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Supervisa usuarios del sistema, organizaciones y clientes.
                </p>
            </div>
        </div>

        <UTabs :items="[
            { slot: 'plataforma', label: 'Admin de Plataforma' },
            { slot: 'organizaciones', label: 'Organizaciones' },
            { slot: 'clientes', label: 'Clientes' },
        ]">
            <template #plataforma>
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Usuarios del Sistema</h2>
                            <p class="text-sm text-slate-500 dark:text-slate-400">
                                Gestiona los administradores y usuarios tecnicos de la plataforma.
                            </p>
                        </div>
                        <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
                            Nuevo Usuario
                        </UButton>
                    </div>

                    <UAlert
                        v-if="selfDeactivateAlert"
                        color="warning"
                        variant="soft"
                        icon="i-heroicons-exclamation-triangle"
                        :title="selfDeactivateAlert"
                    />

                    <SystemUserTable :users="systemUsers" :loading="usersLoading" :page="systemUserPage"
                        :page-count="systemUserPageCount" @edit="setFormFromUser" @toggle="handleToggleSystemUser"
                        @previous-page="loadSystemUserPage(systemUserPage - 1)"
                        @next-page="loadSystemUserPage(systemUserPage + 1)" />
                </div>

                <UModal :open="isSystemUserModalOpen" :title="isEditing ? 'Editar Usuario' : 'Nuevo Usuario'"
                    :description="isEditing ? 'Modifica los datos del usuario del sistema.' : 'Completa el formulario para crear un nuevo usuario del sistema.'"
                    @update:open="isSystemUserModalOpen = $event">
                    <template #body>
                        <SystemUserForm :is-editing="isEditing" :form-state="formState" :form-error="formError"
                            :action-loading="actionLoading" @update:form-state="Object.assign(formState, $event)"
                            @save="saveUser" @reset="resetForm" />
                    </template>
                </UModal>
            </template>

            <template #organizaciones>
                <div v-if="!orgUsersLoaded" class="mb-4">
                    <UButton color="primary" variant="soft" @click="loadOrgUserPage(orgUserPage)">
                        Cargar usuarios de organizaciones
                    </UButton>
                </div>
                <OrgUserTable :grouped-users="groupedOrgUsers" :loading="orgUsersLoading" :page="orgUserPage"
                    :page-count="orgUserPageCount" @block="handleBlockOrgUser"
                    @reset-password="handleResetOrgUserPassword" @previous-page="loadOrgUserPage(orgUserPage - 1)"
                    @next-page="loadOrgUserPage(orgUserPage + 1)" />
            </template>

            <template #clientes>
                <div v-if="!clientsLoaded" class="mb-4">
                    <UButton color="primary" variant="soft" @click="loadClientPage(clientPage)">
                        Cargar usuarios clientes
                    </UButton>
                </div>
                <ClientTable :users="clients" :loading="clientsLoading" :page="clientPage" :page-count="clientPageCount"
                    @block="handleBlockClient" @reset-password="handleResetClientPassword"
                    @previous-page="loadClientPage(clientPage - 1)" @next-page="loadClientPage(clientPage + 1)" />
            </template>
        </UTabs>

        <div v-if="error"
            class="rounded-3xl border border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            {{ error }}
        </div>
    </div>
</template>
