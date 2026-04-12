<script setup lang="ts">
import type { ClientUser } from "@/composables/useSystemAdmin";

interface Props {
    users: ClientUser[];
    loading: boolean;
    page: number;
    pageCount: number;
}

interface Emits {
    (e: "block", user: ClientUser): void;
    (e: "reset-password", user: ClientUser): void;
    (e: "previous-page"): void;
    (e: "next-page"): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<template>
    <div class="overflow-x-auto">
        <table class="min-w-full border-separate border-spacing-0 text-sm text-left text-slate-700 dark:text-slate-300">
            <thead>
                <tr class="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <th class="px-4 py-3">Email</th>
                    <th class="px-4 py-3">Nombre</th>
                    <th class="px-4 py-3">Estado</th>
                    <th class="px-4 py-3">Creado</th>
                    <th class="px-4 py-3">Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="loading" class="border-t border-slate-200 dark:border-slate-800">
                    <td class="px-4 py-4 text-slate-500 dark:text-slate-400" colspan="5">
                        Cargando clientes...
                    </td>
                </tr>
                <tr v-else-if="users.length === 0" class="border-t border-slate-200 dark:border-slate-800">
                    <td class="px-4 py-4 text-slate-500 dark:text-slate-400" colspan="5">
                        No hay clientes registrados.
                    </td>
                </tr>
                <tr v-for="user in users" :key="user.id"
                    class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                    <td class="px-4 py-4 truncate max-w-[200px]">{{ user.email }}</td>
                    <td class="px-4 py-4 truncate max-w-[200px]">{{ user.full_name }}</td>
                    <td class="px-4 py-4">
                        <UBadge :color="user.is_active ? 'success' : 'error'" variant="soft">
                            {{ user.is_active ? "Activo" : "Bloqueado" }}
                        </UBadge>
                    </td>
                    <td class="px-4 py-4">{{ new Date(user.created_at).toLocaleDateString("es-BO") }}</td>
                    <td class="px-4 py-4">
                        <UDropdownMenu :items="[
                            [{
                                label: user.is_active ? 'Bloquear' : 'Desbloquear',
                                icon: user.is_active ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open',
                                click: () => $emit('block', user)
                            }],
                            [{
                                label: 'Resetear contraseña',
                                icon: 'i-heroicons-key',
                                click: () => $emit('reset-password', user)
                            }]
                        ]">
                            <UButton icon="i-heroicons-ellipsis-horizontal-20-solid" color="gray" variant="ghost"
                                size="sm" />
                        </UDropdownMenu>
                    </td>
                </tr>
            </tbody>
        </table>

        <div
            class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-0 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <p>Página {{ page }} de {{ pageCount }}</p>
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
