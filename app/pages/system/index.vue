<script setup lang="ts">
import { onMounted } from "vue";
import { useSystemAdmin } from "@/composables/useSystemAdmin";

definePageMeta({
    middleware: ["system-only"],
    title: "System Dashboard",
});

const {
    stats,
    alerts,
    dashboardLoading,
    error,
    loadDashboard,
} = useSystemAdmin();

const quickActions = [
    {
        label: "Validacion de pagos",
        to: "/system/payment-validations",
        icon: "i-heroicons-credit-card",
        description: "Revisa comprobantes de onboarding.",
    },
    {
        label: "Gestion de usuarios",
        to: "/system/users",
        icon: "i-heroicons-users",
        description: "Administra accesos y permisos de usuarios system.",
    },
];

onMounted(async () => {
    await loadDashboard();
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p class="text-sm uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">System</p>
                <h1 class="text-3xl font-bold text-slate-950 dark:text-white">Dashboard de System</h1>
                <p class="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                    Monitorea validaciones, accesos de usuario y alertas de plataforma desde un solo lugar.
                </p>
            </div>

            <div class="flex items-center gap-3">
                <UButton color="primary" :loading="dashboardLoading" @click="loadDashboard">
                    Refrescar
                </UButton>
            </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-4">
            <UCard
                class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div class="flex items-center gap-4">
                    <div
                        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <UIcon name="i-lucide-alert-triangle" class="h-6 w-6" />
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Validaciones pendientes</p>
                        <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{{
                            stats.pendingValidations }}</p>
                    </div>
                </div>
            </UCard>

            <UCard
                class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div class="flex items-center gap-4">
                    <div
                        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <UIcon name="i-lucide-check-circle-2" class="h-6 w-6" />
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Aprobados hoy</p>
                        <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{{ stats.approvedToday }}
                        </p>
                    </div>
                </div>
            </UCard>

            <UCard
                class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div class="flex items-center gap-4">
                    <div
                        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        <UIcon name="i-lucide-users" class="h-6 w-6" />
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Usuarios system activos</p>
                        <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{{ stats.activeSystemUsers
                            }}</p>
                    </div>
                </div>
            </UCard>

            <UCard
                class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div class="flex items-center gap-4">
                    <div
                        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <UIcon name="i-lucide-building" class="h-6 w-6" />
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Organizaciones</p>
                        <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{{
                            stats.totalOrganizations }}</p>
                    </div>
                </div>
            </UCard>
        </div>

        <div class="grid gap-4 xl:grid-cols-[minmax(560px,1fr)_minmax(320px,360px)]">
            <UCard
                class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div
                    class="flex items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-4 dark:border-slate-800">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Alertas</h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Eventos recientes que requieren atencion.
                        </p>
                    </div>
                    <UButton color="neutral" variant="soft" size="sm" @click="loadDashboard">
                        Actualizar
                    </UButton>
                </div>

                <div class="space-y-3 p-6">
                    <template v-if="alerts.length > 0">
                        <div v-for="alert in alerts" :key="alert.id"
                            class="rounded-3xl border p-4 dark:border-slate-800">
                            <div class="flex items-center gap-3">
                                <div
                                    class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                    <UIcon
                                        :name="alert.severity === 'warning' ? 'i-lucide-alert-triangle' : alert.severity === 'info' ? 'i-lucide-info' : 'i-lucide-check-circle'"
                                        class="h-5 w-5" />
                                </div>
                                <div>
                                    <p class="font-semibold text-slate-950 dark:text-white">{{ alert.title }}</p>
                                    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ alert.description }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </template>
                    <p v-else class="text-sm text-slate-500 dark:text-slate-400">No hay alertas en este momento.</p>
                </div>
            </UCard>

            <UCard
                class="rounded-[1.5rem] border border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                <div class="border-b border-slate-200/80 px-6 py-4 dark:border-slate-800">
                    <h2 class="text-lg font-semibold text-slate-950 dark:text-white">Accesos rapidos</h2>
                </div>

                <div class="space-y-3 p-6">
                    <div v-for="action in quickActions" :key="action.to"
                        class="rounded-3xl border border-slate-200/80 p-4 transition hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-500/70">
                        <NuxtLink :to="action.to" class="flex items-start gap-3">
                            <div
                                class="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                <UIcon :name="action.icon" class="h-5 w-5" />
                            </div>
                            <div>
                                <p class="font-semibold text-slate-950 dark:text-white">{{ action.label }}</p>
                                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ action.description }}</p>
                            </div>
                        </NuxtLink>
                    </div>
                </div>
            </UCard>
        </div>

        <div v-if="error"
            class="rounded-3xl border border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            {{ error }}
        </div>
    </div>
</template>
