<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import type { Database } from "@/types/database.types";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
type SystemProfileRow = Pick<
  SystemUserRow,
  "user_id" | "email" | "full_name" | "role" | "is_active" | "created_at" | "updated_at"
>;

definePageMeta({
  middleware: ["system-only"],
  title: "System Profile",
});

const supabase = useSupabaseClient<Database>();
const session = useSupabaseSession();

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const profile = ref<SystemProfileRow | null>(null);

const formState = reactive({
  email: "",
  fullName: "",
  password: "",
  confirmPassword: "",
});

const getSystemRequestHeaders = async () => {
  let token = session.value?.access_token;

  if (!token) {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    token = data.session?.access_token;
  }

  if (!token) {
    throw new Error("No se encontro una sesion valida.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const setFormFromProfile = (row: SystemProfileRow) => {
  formState.email = row.email ?? "";
  formState.fullName = row.full_name ?? "";
  formState.password = "";
  formState.confirmPassword = "";
};

const loadProfile = async () => {
  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    const response = await $fetch<{ row: SystemProfileRow }>("/api/system/profile", {
      headers: await getSystemRequestHeaders(),
    });
    profile.value = response.row ?? null;
    if (profile.value) {
      setFormFromProfile(profile.value);
    }
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "No se pudo cargar el perfil.";
  } finally {
    loading.value = false;
  }
};

const saveProfile = async () => {
  error.value = null;
  success.value = null;

  if (!formState.fullName.trim()) {
    error.value = "El nombre completo es obligatorio.";
    return;
  }

  if (!formState.email.trim()) {
    error.value = "El email es obligatorio.";
    return;
  }

  if (formState.password || formState.confirmPassword) {
    if (formState.password.length < 8) {
      error.value = "La contrasena debe tener al menos 8 caracteres.";
      return;
    }

    if (formState.password !== formState.confirmPassword) {
      error.value = "La confirmacion de contrasena no coincide.";
      return;
    }
  }

  saving.value = true;

  try {
    const response = await $fetch<{ row: SystemProfileRow }>("/api/system/profile", {
      method: "PATCH",
      headers: await getSystemRequestHeaders(),
      body: {
        email: formState.email.trim(),
        fullName: formState.fullName.trim(),
        password: formState.password.trim() || null,
      },
    });

    profile.value = response.row;
    setFormFromProfile(response.row);
    success.value = "Perfil actualizado correctamente.";
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : "No se pudo actualizar el perfil.";
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await loadProfile();
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">System</p>
      <h1 class="text-3xl font-bold text-slate-950 dark:text-white">Mi perfil</h1>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Revisa y actualiza tus datos de acceso de usuario system.
      </p>
    </div>

    <UCard class="rounded-3xl border border-slate-200/80 dark:border-slate-800">
      <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
        Cargando perfil...
      </div>

      <div v-else class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Rol</p>
            <UBadge color="primary" variant="soft" class="capitalize">{{ profile?.role ?? "-" }}</UBadge>
          </div>
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Estado</p>
            <UBadge :color="profile?.is_active ? 'success' : 'neutral'" variant="soft">
              {{ profile?.is_active ? "Activo" : "Inactivo" }}
            </UBadge>
          </div>
        </div>

        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre completo</label>
          <UInput v-model="formState.fullName" placeholder="Ej. Maria Lopez" size="lg" class="w-full" />
        </div>

        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <UInput v-model="formState.email" type="email" placeholder="usuario@dominio.com" size="lg" class="w-full" />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-3">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Nueva contrasena (opcional)</label>
            <UInput v-model="formState.password" type="password" autocomplete="new-password" placeholder="Minimo 8 caracteres" />
          </div>
          <div class="space-y-3">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar contrasena</label>
            <UInput v-model="formState.confirmPassword" type="password" autocomplete="new-password" placeholder="Repite la contrasena" />
          </div>
        </div>

        <UAlert
          v-if="success"
          color="success"
          variant="soft"
          icon="i-heroicons-check-circle"
          :title="success"
        />

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          :title="error"
        />

        <div class="flex justify-end">
          <UButton color="primary" :loading="saving" @click="saveProfile">
            Guardar cambios
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
