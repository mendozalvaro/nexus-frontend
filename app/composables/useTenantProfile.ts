import type { Tables } from "@/types/database.types";

type ProfileRow = Tables<"profiles">;

export interface TenantProfileFormState {
  fullName: string;
  phone: string;
  avatarUrl: string;
}

export interface TenantPasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const defaultFormState = (): TenantProfileFormState => ({
  fullName: "",
  phone: "",
  avatarUrl: "",
});

const defaultPasswordState = (): TenantPasswordFormState => ({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

export const useTenantProfile = () => {
  const { profile, fetchProfile, updateProfile } = useAuth();

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  const formState = reactive<TenantProfileFormState>(defaultFormState());
  const passwordState = reactive<TenantPasswordFormState>(defaultPasswordState());

  const setFormFromProfile = (p: ProfileRow | null) => {
    if (!p) return;
    formState.fullName = p.full_name ?? "";
    formState.phone = p.phone ?? "";
    formState.avatarUrl = p.avatar_url ?? "";
  };

  const loadProfile = async () => {
    loading.value = true;
    error.value = null;
    success.value = null;

    try {
      const data = await fetchProfile({ force: true });
      if (data) {
        setFormFromProfile(data as ProfileRow);
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

    saving.value = true;

    try {
      const result = await updateProfile({
        full_name: formState.fullName.trim(),
        phone: formState.phone.trim() || null,
        avatar_url: formState.avatarUrl.trim() || null,
      });

      if (result.error) {
        error.value = result.error;
        return;
      }

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
      await $fetch<ProfileRow>("/api/profile", {
        method: "PATCH",
        body: {
          current_password: passwordState.currentPassword,
          new_password: passwordState.newPassword,
        },
      });

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
    setFormFromProfile(profile.value as ProfileRow);
    error.value = null;
    success.value = null;
  };

  const resetPasswordForm = () => {
    Object.assign(passwordState, defaultPasswordState());
    error.value = null;
    success.value = null;
  };

  return {
    profile: computed(() => profile.value as ProfileRow | null),
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
