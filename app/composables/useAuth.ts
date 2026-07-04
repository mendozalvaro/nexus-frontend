import type { Session, User } from "@supabase/supabase-js";

import type {
  AuthOAuthProvider,
  AuthErrorPayload,
  AuthOperationResult,
  AuthState,
  Profile,
  SignInOptions,
  SignInWithProviderOptions,
  SignOutOptions,
  SignUpData,
  UpdateProfileInput,
  UserRole,
} from "../types/auth";
import type { Database } from "../types/database.types";

import { useAuthAudit } from "@/composables/auth/useAuthAudit";
import { useClientProfileState } from "@/composables/auth/useClientProfileState";
import {
  createPermissionDeniedMessage,
  buildOAuthCallbackPath,
  isStaffRole,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  sanitizeAuthEmail,
  sanitizeNullableString,
  sanitizeRole,
  sanitizeString,
} from "@/utils/auth";

const AUTH_CALLBACK_ROUTE = "/auth/callback";
const AUTH_LOGIN_ROUTE = "/auth/login";
const AUTH_ERROR_CODE_DEFAULT = "AUTH_UNKNOWN_ERROR";

const normalizeAuthError = (
  rawError: unknown,
  fallbackMessage: string,
  fallbackCode = AUTH_ERROR_CODE_DEFAULT,
): AuthErrorPayload => {
  if (rawError && typeof rawError === "object") {
    const maybeError = rawError as {
      message?: unknown;
      code?: unknown;
      status?: unknown;
      name?: unknown;
    };

    const message =
      typeof maybeError.message === "string" && maybeError.message.trim().length > 0
        ? maybeError.message
        : fallbackMessage;

    if (typeof maybeError.code === "string" && maybeError.code.trim().length > 0) {
      return {
        code: maybeError.code,
        message,
        details: rawError,
      };
    }

    if (typeof maybeError.status === "number") {
      return {
        code: `AUTH_HTTP_${maybeError.status}`,
        message,
        details: rawError,
      };
    }

    if (typeof maybeError.name === "string" && maybeError.name.trim().length > 0) {
      return {
        code: `AUTH_${maybeError.name.toUpperCase()}`,
        message,
        details: rawError,
      };
    }
  }

  if (rawError instanceof Error) {
    return {
      code: fallbackCode,
      message: rawError.message || fallbackMessage,
      details: rawError,
    };
  }

  return {
    code: fallbackCode,
    message: fallbackMessage,
    details: rawError,
  };
};

export const useAuth = () => {
  const supabase = useSupabaseClient<Database>();
  const { resolveUser } = useSessionAccess();
  const {
    user,
    profile,
    role,
    organizationId,
    activeOrganizationId,
    organizationContext,
    refreshProfile: refreshProfileFromContext,
    ensureContext,
    resetContext,
    setActiveOrganization,
  } = useUserContext();

  const session = useSupabaseSession();
  const isLoading = useState<boolean>("auth:is-loading", () => false);
  const isSubmitting = useState<boolean>("auth:is-submitting", () => false);
  const error = useState<string | null>("auth:error", () => null);
  const errorPayload = useState<AuthErrorPayload | null>("auth:error-payload", () => null);
  const watcherInitialized = useState<boolean>("auth:watcher-initialized", () => false);

  const {
    clientProfile,
    clientProfileFetchedForOrgId,
    clientProfileLoading,
    fetchClientProfile,
    clearClientProfileState,
  } = useClientProfileState(user, activeOrganizationId, resolveUser);

  const { auditCriticalAction } = useAuthAudit(user);

  const resolvedRole = computed<UserRole | "guest">(() => {
    if (isStaffRole(role.value)) {
      return role.value;
    }

    if (role.value === "client" && !activeOrganizationId.value) {
      return "client";
    }

    if (role.value === "client" && (
      clientProfileFetchedForOrgId.value !== activeOrganizationId.value
      || clientProfileLoading.value
    )) {
      return "client";
    }

    if (clientProfile.value?.orgStatus === "active") {
      return "client";
    }

    return "guest";
  });

  const setError = (message: string | null) => {
    error.value = message;
    if (!message) {
      errorPayload.value = null;
    }
  };

  const setErrorPayload = (payload: AuthErrorPayload | null) => {
    errorPayload.value = payload;
    error.value = payload?.message ?? null;
  };

  const useOrgContext = () => ({
    context: readonly(organizationContext),
    activeOrganizationId,
    setActiveOrganization,
  });

  const useClientProfile = () => ({
    profile: readonly(clientProfile),
    fetchClientProfile,
  });

  const resetTransientState = () => {
    isLoading.value = false;
    isSubmitting.value = false;
    error.value = null;
    errorPayload.value = null;
  };

  const executeAuthAction = async <T>(
    action: () => Promise<T>,
    fallbackMessage: string,
    fallbackCode: string,
  ): Promise<AuthOperationResult<T>> => {
    isSubmitting.value = true;
    setError(null);

    try {
      const data = await action();
      return {
        data,
        error: null,
      };
    } catch (actionError) {
      const normalizedError = normalizeAuthError(actionError, fallbackMessage, fallbackCode);
      setErrorPayload(normalizedError);
      return {
        data: null,
        error: normalizedError.message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  const fetchProfile = async (
    options: { force?: boolean } = {},
  ): Promise<Profile | null> => {
    const forceRefresh = options.force === true;
    setError(null);

    try {
      const { user: currentUser } = await ensureContext({
        requireProfile: false,
      });
      if (!currentUser) {
        profile.value = null;
        return null;
      }

      const data = await refreshProfileFromContext({ force: forceRefresh });
      profile.value = data;

      if (data?.role === "client" && data.organization_id) {
        await fetchClientProfile({
          force: forceRefresh,
          organizationId: data.organization_id,
        });
      } else {
        clearClientProfileState();
      }

      return data ?? null;
    } catch (fetchError) {
      const normalizedError = normalizeAuthError(
        fetchError,
        "No se pudo cargar el perfil.",
        "AUTH_PROFILE_FETCH_ERROR",
      );
      setErrorPayload(normalizedError);
      profile.value = null;
      return null;
    }
  };

  const signIn = async (
    email: string,
    password: string,
    options: SignInOptions = {},
  ): Promise<AuthOperationResult<Session>> => {
    const sanitizedEmail = sanitizeAuthEmail(email);
    const sanitizedPassword = sanitizeString(password);

    isSubmitting.value = true;
    setError(null);

    try {
      if (!isValidEmail(sanitizedEmail)) {
        throw new Error("Ingresa un email válido.");
      }

      if (sanitizedPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error("La contraseña debe tener al menos 8 caracteres.");
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: sanitizedPassword,
      });

      if (signInError) {
        await auditCriticalAction("LOGIN_FAILED", "auth", {
          event: "LOGIN_FAILED",
          email: sanitizedEmail,
          reason: signInError.message,
        });
        throw signInError;
      }

      if (options.resolveProfile !== false) {
        const resolvedProfile = await fetchProfile();
        const signedInRole = data.user?.user_metadata?.role;

        if (!resolvedProfile && signedInRole === "client") {
          await supabase.auth.signOut();
          resetContext();
          clearClientProfileState();
          resetTransientState();
          throw new Error("Esta cuenta no tiene acceso al panel interno.");
        }
      } else {
        clearClientProfileState();
        await ensureContext({ requireProfile: false, forceUserValidation: true });
      }

      console.info("[AUTH_LOGIN_SUCCESS]", {
        userId: data.user?.id ?? null,
        role: role.value,
        organizationId: organizationId.value,
      });

      await auditCriticalAction("INSERT", "auth_sessions", {
        event: "LOGIN_SUCCESS",
        email: sanitizedEmail,
        role: role.value,
        organization_id: organizationId.value,
      });

      return {
        data: data.session,
        error: null,
      };
    } catch (signInError) {
      const normalizedError = normalizeAuthError(signInError, "No se pudo iniciar sesión.", "AUTH_SIGN_IN_ERROR");
      setErrorPayload(normalizedError);

      return {
        data: null,
        error: normalizedError.message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  const signInWithProvider = async (
    provider: AuthOAuthProvider,
    options: SignInWithProviderOptions,
  ): Promise<AuthOperationResult<null>> => {
    return executeAuthAction(async () => {
      if (!import.meta.client) {
        throw new Error("OAuth solo esta disponible en el cliente.");
      }

      const redirectTo = `${window.location.origin}${buildOAuthCallbackPath({
        audience: options.audience,
        redirect: options.redirect,
        slug: options.slug,
      })}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (oauthError) {
        throw oauthError;
      }

      return null;
    }, "No se pudo iniciar sesion con Google.", "AUTH_OAUTH_SIGN_IN_ERROR");
  };

  const signOut = async (options: SignOutOptions = {}): Promise<AuthOperationResult> => {
    return executeAuthAction(async () => {
      const currentUserId = user.value?.id ?? null;
      const redirectTo = options.redirectTo?.trim() || AUTH_LOGIN_ROUTE;

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }

      resetContext();
      clearClientProfileState();
      resetTransientState();

      console.info("[AUTH_SIGN_OUT]", { userId: currentUserId });

      await navigateTo(redirectTo);
      return null;
    }, "No se pudo cerrar sesión.", "AUTH_SIGN_OUT_ERROR");
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    roleInput?: UserRole,
    organizationIdInput?: string | null,
  ): Promise<AuthOperationResult<User>> => {
    const sanitizedEmail = sanitizeAuthEmail(email);
    const sanitizedPassword = sanitizeString(password);
    const sanitizedFullName = sanitizeString(fullName);
    const sanitizedOrganizationId = sanitizeNullableString(organizationIdInput);
    const isPublicRegistration = !sanitizedOrganizationId;
    const sanitizedRole = sanitizeRole(roleInput, isPublicRegistration);

    return executeAuthAction(async () => {
      if (!isValidEmail(sanitizedEmail)) {
        throw new Error("Ingresa un email válido.");
      }

      if (sanitizedPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error("La contraseña debe tener al menos 8 caracteres.");
      }

      if (!sanitizedFullName) {
        throw new Error("El nombre completo es obligatorio.");
      }

      const payload: SignUpData = {
        email: sanitizedEmail,
        password: sanitizedPassword,
        fullName: sanitizedFullName,
        role: sanitizedRole,
        organizationId: sanitizedOrganizationId,
        isPublic: isPublicRegistration,
      };

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName,
            role: payload.role,
            organization_id: payload.organizationId,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      console.info("[AUTH_SIGN_UP]", {
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
      });

      await auditCriticalAction("INSERT", "profiles", {
        event: "SIGN_UP",
        email: payload.email,
        role: payload.role ?? null,
        organization_id: payload.organizationId ?? null,
      });

      if (data.user) {
        await fetchProfile();
        await fetchClientProfile({ force: true });
      }
      if (!data.user) {
        throw new Error("No se pudo resolver el usuario registrado.");
      }
      return data.user;
    }, "No se pudo completar el registro.", "AUTH_SIGN_UP_ERROR");
  };

  const updateProfile = async (
    updates: UpdateProfileInput,
  ): Promise<AuthOperationResult<Profile>> => {
    if (!user.value) {
      const message = createPermissionDeniedMessage();
      setErrorPayload({
        code: "AUTH_PERMISSION_DENIED",
        message,
      });
      await auditCriticalAction("PERMISSION_DENIED", "profiles", {
        event: "PERMISSION_DENIED",
        reason: "User tried to update profile without an active session.",
      });
      return { data: null, error: message };
    }

    isSubmitting.value = true;
    setError(null);

    try {
      const sanitizedUpdates: UpdateProfileInput = {
        full_name: updates.full_name ? sanitizeString(updates.full_name) : undefined,
        phone:
          typeof updates.phone === "string" || updates.phone === null
            ? sanitizeNullableString(updates.phone)
            : undefined,
        avatar_url:
          typeof updates.avatar_url === "string" || updates.avatar_url === null
            ? sanitizeNullableString(updates.avatar_url)
            : undefined,
      };

      if (sanitizedUpdates.full_name !== undefined && !sanitizedUpdates.full_name) {
        throw new Error("El nombre completo no puede estar vacío.");
      }

      const previousProfile = profile.value;
      const data = await $fetch<Profile>("/api/profile", {
        method: "PATCH",
        body: sanitizedUpdates,
      });

      profile.value = data;
      await refreshProfileFromContext({ force: true });

      console.info("[AUTH_PROFILE_UPDATED]", {
        userId: user.value.id,
        organizationId: organizationId.value,
      });

      await auditCriticalAction("UPDATE", "profiles", {
        event: "PROFILE_UPDATED",
        organization_id: organizationId.value,
        role: role.value,
      }, {
        recordId: user.value.id,
        oldData: previousProfile,
        newData: data,
      });

      return {
        data,
        error: null,
      };
    } catch (updateError) {
      const normalizedError = normalizeAuthError(updateError, "No se pudo actualizar el perfil.", "AUTH_PROFILE_UPDATE_ERROR");
      setErrorPayload(normalizedError);

      return {
        data: null,
        error: normalizedError.message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  const resetPassword = async (email: string): Promise<AuthOperationResult> => {
    const sanitizedEmail = sanitizeAuthEmail(email);
    return executeAuthAction(async () => {
      if (!isValidEmail(sanitizedEmail)) {
        throw new Error("Ingresa un email válido.");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        sanitizedEmail,
        {
          redirectTo: `${window.location.origin}${AUTH_CALLBACK_ROUTE}`,
        },
      );

      if (resetError) {
        throw resetError;
      }
      return null;
    }, "No se pudo enviar el email de recuperación.", "AUTH_PASSWORD_RESET_ERROR");
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!role.value) {
      return false;
    }

    return roles.includes(role.value);
  };

  const isInOrganization = (orgId: string): boolean => {
    const sanitizedOrgId = sanitizeString(orgId);
    if (!sanitizedOrgId) {
      return false;
    }

    return organizationId.value === sanitizedOrgId;
  };

  const state = computed<AuthState>(() => ({
    user: user.value,
    profile: profile.value,
    organizationId: organizationId.value,
    role: role.value,
  }));

  if (!watcherInitialized.value) {
    watcherInitialized.value = true;

    watch(
      () => session.value?.user?.id ?? null,
      (userId) => {
        if (!userId) {
          clearClientProfileState();
          return;
        }
      },
      { immediate: true },
    );
  }

  return {
    user,
    session,
    profile,
    isLoading,
    isSubmitting,
    error,
    errorPayload,
    state,
    resolvedRole,
    activeOrganizationId,
    clientProfile,
    fetchProfile,
    fetchClientProfile,
    signIn,
    signInWithProvider,
    signOut,
    signUp,
    updateProfile,
    resetPassword,
    auditCriticalAction,
    useOrgContext,
    useClientProfile,
    hasRole,
    isInOrganization,
  };
};
