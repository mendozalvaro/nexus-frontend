import type { Database } from "@/types/database.types";

type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];

export interface SystemProfileFormState {
  fullName: string;
  email: string;
}

export interface SystemPasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const defaultFormState = (): SystemProfileFormState => ({
  fullName: "",
  email: "",
});

const defaultPasswordState = (): SystemPasswordFormState => ({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

export const useSystemProfile = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  const profile = ref<Pick<SystemUserRow, "user_id" | "email" | "full_name" | "role" | "is_active" | "created_at" | "updated_at"> | null>(null);

  const formState = reactive<SystemProfileFormState>(defaultFormState());
  const passwordState = reactive<SystemPasswordFormState>(defaultPasswordState());

  const getSystemRequestHeaders = async () => {
    let token = session.value?.access_token;

    if (!token) {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      token = data.session?.access_token;
    }

    if (!token) throw new Error("No se encontro una sesion valida.");

    return { Authorization: `Bearer ${token}` };
  };

  const setFormFromProfile = (p: typeof profile.value) => {
    if (!p) return;
    formState.email = p.email ?? "";
    formState.fullName = p.full_name ?? "";
  };

  const loadProfile = async () => {
    loading.value = true;
    error.value = null;
    success.value = null;

    try {
      const response = await $fetch<{ row: typeof profile.value }>("/api/system/profile", {
        headers: await getSystemRequestHeaders(),
      });
      profile.value = response.row ?? null;
      if (profile.value) {
        setFormFromProfile(profile.value);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cargar el perfil.";
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

    saving.value = true;

    try {
      const response = await $fetch<{ row: typeof profile.value }>("/api/system/profile", {
        method: "PATCH",
        headers: await getSystemRequestHeaders(),
        body: {
          email: formState.email.trim(),
          fullName: formState.fullName.trim(),
          password: null,
        },
      });

      profile.value = response.row;
      setFormFromProfile(response.row);
      success.value = "Perfil actualizado correctamente.";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo actualizar el perfil.";
    } finally {
      saving.value = false;
    }
  };

  const changePassword = async () => {
    error.value = null;
    success.value = null;

    if (!passwordState.currentPassword) {
      error.value = "La contrasena actual es obligatoria.";
      return;
    }

    if (passwordState.newPassword.length < 8) {
      error.value = "La nueva contrasena debe tener al menos 8 caracteres.";
      return;
    }

    if (passwordState.newPassword !== passwordState.confirmPassword) {
      error.value = "La confirmacion de contrasena no coincide.";
      return;
    }

    saving.value = true;

    try {
      const response = await $fetch<{ row: typeof profile.value }>("/api/system/profile", {
        method: "PATCH",
        headers: await getSystemRequestHeaders(),
        body: {
          current_password: passwordState.currentPassword,
          new_password: passwordState.newPassword,
        },
      });

      profile.value = response.row;
      passwordState.currentPassword = "";
      passwordState.newPassword = "";
      passwordState.confirmPassword = "";
      success.value = "Contrasena actualizada correctamente.";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo cambiar la contrasena.";
    } finally {
      saving.value = false;
    }
  };

  const resetForm = () => {
    Object.assign(formState, defaultFormState());
    if (profile.value) {
      setFormFromProfile(profile.value);
    }
    error.value = null;
    success.value = null;
  };

  const resetPasswordForm = () => {
    Object.assign(passwordState, defaultPasswordState());
    error.value = null;
    success.value = null;
  };

  return {
    profile,
    loading,
    saving,
    error,
    success,
    formState,
    passwordState,
    loadProfile,
    saveProfile,
    changePassword,
    resetForm,
    resetPasswordForm,
  };
};
