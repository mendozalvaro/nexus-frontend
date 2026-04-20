<script setup lang="ts">
import { computed } from "vue";

interface Props {
    isEditing: boolean;
    formState: {
        email: string;
        fullName: string;
        password: string;
        confirmPassword: string;
        role: string;
    };
    formError: string | null;
    actionLoading: boolean;
}

interface Emits {
    (e: "update:formState", value: Props["formState"]): void;
    (e: "save"): void;
    (e: "reset"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formState = computed({
    get: () => props.formState,
    set: (val) => emit("update:formState", val),
});
</script>

<template>
    <div class="space-y-5">
        <div
            class="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <div class="space-y-3">
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <UInput v-model="formState.email" type="email" placeholder="usuario@dominio.com" size="lg"
                    class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
            </div>

            <div class="space-y-3">
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre completo</label>
                <UInput v-model="formState.fullName" placeholder="Ej. Maria Lopez" size="lg" class="w-full"
                    :ui="{ base: 'min-h-11 text-base' }" />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-3">
                    <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {{ isEditing ? "Nueva contraseña (opcional)" : "Contraseña" }}
                    </label>
                    <UInput v-model="formState.password" type="password" autocomplete="new-password"
                        placeholder="Minimo 8 caracteres" size="lg" class="w-full"
                        :ui="{ base: 'min-h-11 text-base' }" />
                </div>
                <div class="space-y-3">
                    <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Confirmar contraseña
                    </label>
                    <UInput v-model="formState.confirmPassword" type="password" autocomplete="new-password"
                        placeholder="Repite la contraseña" size="lg" class="w-full"
                        :ui="{ base: 'min-h-11 text-base' }" />
                </div>
            </div>

            <div class="space-y-3">
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Rol</label>
                <USelect v-model="formState.role" size="lg" class="w-full" :options="[
                    { label: 'system', value: 'system' },
                    { label: 'support', value: 'support' },
                ]" />
            </div>

            <div v-if="formError"
                class="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-200">
                {{ formError }}
            </div>

            <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <UButton variant="ghost" color="neutral" @click="$emit('reset')">Limpiar</UButton>
                <UButton :loading="actionLoading" color="primary" @click="$emit('save')">
                    {{ isEditing ? "Actualizar usuario" : "Crear usuario" }}
                </UButton>
            </div>
        </div>
    </div>
</template>
