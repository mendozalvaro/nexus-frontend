<script setup lang="ts">
import type { OrganizationUser } from "@/composables/useSystemAdmin";

interface Props {
    groupedUsers: Array<{
        org: { id: string; name: string };
        adminUsers: OrganizationUser[];
        dependentUsers: OrganizationUser[];
    }>;
    loading: boolean;
    page: number;
    pageCount: number;
}

interface Emits {
    (e: "block", user: OrganizationUser): void;
    (e: "reset-password", user: OrganizationUser): void;
    (e: "previous-page"): void;
    (e: "next-page"): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<template>
    <div class="space-y-6">
        <div v-if="loading" class="text-slate-500 dark:text-slate-400">Cargando organizaciones...</div>
        <div v-else-if="groupedUsers.length === 0" class="text-slate-500 dark:text-slate-400">
            No hay organizaciones con usuarios.
        </div>
        <div v-else class="space-y-6">
            <div
                v-for="group in groupedUsers"
                :key="group.org.id"
                class="rounded-lg border border-slate-200 dark:border-slate-700"
            >
                <div class="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <h3 class="font-medium text-slate-900 dark:text-white">{{ group.org.name }}</h3>
                </div>

                <div class="p-4">
                    <ul class="space-y-3">
                        <li>
                            <div class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
                                {{ group.org.name }}
                            </div>

                            <ul class="ml-4 mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700">
                                <li>
                                    <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        Admin
                                    </div>
                                    <ul class="ml-4 mt-2 space-y-2 border-l border-slate-200 pl-4 dark:border-slate-700">
                                        <li v-if="group.adminUsers.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                                            Sin admin asignado.
                                        </li>
                                        <li
                                            v-for="user in group.adminUsers"
                                            :key="user.id"
                                            class="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                                        >
                                            <div class="flex items-center justify-between">
                                                <div class="min-w-0 flex-1">
                                                    <p class="truncate font-medium text-slate-900 dark:text-white">{{ user.full_name }}</p>
                                                    <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ user.email }}</p>
                                                </div>
                                                <div class="ml-3 flex items-center gap-2">
                                                    <UBadge color="primary" variant="soft" class="capitalize">{{ user.role }}</UBadge>
                                                    <UBadge :color="user.is_active ? 'success' : 'neutral'" variant="soft">
                                                        {{ user.is_active ? "Activo" : "Bloqueado" }}
                                                    </UBadge>
                                                    <UDropdownMenu
                                                        :items="[
                                                            [{
                                                                label: user.is_active ? 'Bloquear' : 'Desbloquear',
                                                                icon: user.is_active ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open',
                                                                click: () => $emit('block', user),
                                                            }],
                                                            [{
                                                                label: 'Resetear contrasena',
                                                                icon: 'i-heroicons-key',
                                                                click: () => $emit('reset-password', user),
                                                            }],
                                                        ]"
                                                    >
                                                        <UButton icon="i-heroicons-ellipsis-horizontal-20-solid" color="gray" variant="ghost" size="sm" />
                                                    </UDropdownMenu>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </li>

                                <li>
                                    <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        Dependientes (Manager y Employee)
                                    </div>
                                    <ul class="ml-4 mt-2 space-y-2 border-l border-slate-200 pl-4 dark:border-slate-700">
                                        <li v-if="group.dependentUsers.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                                            Sin dependientes.
                                        </li>
                                        <li
                                            v-for="user in group.dependentUsers"
                                            :key="user.id"
                                            class="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                                        >
                                            <div class="flex items-center justify-between">
                                                <div class="min-w-0 flex-1">
                                                    <p class="truncate font-medium text-slate-900 dark:text-white">{{ user.full_name }}</p>
                                                    <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ user.email }}</p>
                                                </div>
                                                <div class="ml-3 flex items-center gap-2">
                                                    <UBadge :color="user.role === 'manager' ? 'warning' : 'info'" variant="soft" class="capitalize">
                                                        {{ user.role }}
                                                    </UBadge>
                                                    <UBadge :color="user.is_active ? 'success' : 'neutral'" variant="soft">
                                                        {{ user.is_active ? "Activo" : "Bloqueado" }}
                                                    </UBadge>
                                                    <UDropdownMenu
                                                        :items="[
                                                            [{
                                                                label: user.is_active ? 'Bloquear' : 'Desbloquear',
                                                                icon: user.is_active ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open',
                                                                click: () => $emit('block', user),
                                                            }],
                                                            [{
                                                                label: 'Resetear contrasena',
                                                                icon: 'i-heroicons-key',
                                                                click: () => $emit('reset-password', user),
                                                            }],
                                                        ]"
                                                    >
                                                        <UButton icon="i-heroicons-ellipsis-horizontal-20-solid" color="gray" variant="ghost" size="sm" />
                                                    </UDropdownMenu>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <div
            v-if="!loading"
            class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-0 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400"
        >
            <p>Pagina {{ page }} de {{ pageCount }}</p>
            <div class="flex gap-2">
                <UButton size="sm" variant="soft" :disabled="page <= 1" @click="$emit('previous-page')">
                    Anterior
                </UButton>
                <UButton size="sm" variant="soft" :disabled="page >= pageCount" @click="$emit('next-page')">
                    Siguiente
                </UButton>
            </div>
        </div>
    </div>
</template>
