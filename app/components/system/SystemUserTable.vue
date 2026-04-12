<script setup lang="ts">
import type { SystemUserRow } from "@/composables/useSystemAdmin";

interface Props {
    users: SystemUserRow[];
    loading: boolean;
    page: number;
    pageCount: number;
}

interface Emits {
    (e: "edit", user: SystemUserRow): void;
    (e: "toggle", user: SystemUserRow): void;
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
                    <th class="px-4 py-3">Rol</th>
                    <th class="px-4 py-3">Activo</th>
                    <th class="px-4 py-3">Creado</th>
                    <th class="px-4 py-3">Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="loading" class="border-t border-slate-200 dark:border-slate-800">
                    <td class="px-4 py-4 text-slate-500 dark:text-slate-400" colspan="6">
                        Cargando usuarios...
                    </td>
                </tr>
                <tr v-else-if="users.length === 0" class="border-t border-slate-200 dark:border-slate-800">
                    <td class="px-4 py-4 text-slate-500 dark:text-slate-400" colspan="6">
                        No hay usuarios registrados.
                    </td>
                </tr>
                <tr v-for="user in users" :key="user.user_id"
                    class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                    <td class="px-4 py-4 truncate max-w-[180px]">{{ user.email || "-" }}</td>
                    <td class="px-4 py-4 truncate max-w-[180px]">{{ user.full_name || "-" }}</td>
                    <td class="px-4 py-4 capitalize">{{ user.role }}</td>
                    <td class="px-4 py-4">
                        <UBadge :color="user.is_active ? 'success' : 'neutral'" variant="soft">
                            {{ user.is_active ? "Activo" : "Inactivo" }}
                        </UBadge>
                    </td>
                    <td class="px-4 py-4">
                        {{ user.created_at ? new Date(user.created_at).toLocaleDateString("es-BO") : "-" }}
                    </td>
                    <td class="px-4 py-4">
                        <div class="flex flex-wrap gap-2">
                            <UButton size="sm" variant="ghost" @click="$emit('edit', user)">
                                Editar
                            </UButton>
                            <UButton size="sm" :color="user.is_active ? 'error' : 'success'" variant="ghost"
                                @click="$emit('toggle', user)">
                                {{ user.is_active ? "Desactivar" : "Activar" }}
                            </UButton>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>

        <div
            class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
