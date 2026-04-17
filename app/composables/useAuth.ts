import type { Session, User } from "@supabase/supabase-js";

import type {
  AuditLogInsert,
  AuthAuditContext,
  AuthOperationResult,
  AuthState,
  Profile,
  SignUpData,
  UpdateProfileInput,
  UserRole,
} from "../types/auth";
import type { Database } from "../types/database.types";
import type { ClientProfileState } from "@/types/client";

const AUTH_CALLBACK_ROUTE = "/auth/callback";
const AUTH_LOGIN_ROUTE = "/auth/login";
const MIN_PASSWORD_LENGTH = 8;
const PROFILE_CACHE_TTL_MS = 30_000;

const sanitizeString = (value: string | null | undefined): string => {
  return value?.trim() ?? "";
};

const sanitizeNullableString = (value: string | null | undefined): string | null => {
  const sanitized = sanitizeString(value);
  return sanitized.length > 0 ? sanitized : null;
};

const sanitizeEmail = (email: string): string => {
  return sanitizeString(email).toLowerCase();
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const sanitizeRole = (role?: UserRole | null, isPublic = false): UserRole => {
  if (isPublic || !role) {
    return "client";
  }

  return role;
};

const getUserMetadata = (user: User | null): Record<string, unknown> => {
  return (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
};

const getMetadataOrganizationId = (user: User | null): string | null => {
  const metadata = getUserMetadata(user);
  const organizationId = metadata.organization_id;

  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
};

const getMetadataRole = (user: User | null): UserRole | null => {
  const metadata = getUserMetadata(user);
  const role = metadata.role;

  return typeof role === "string" ? (role as UserRole) : null;
};

const createPermissionDeniedMessage = (): string => {
  return "No tienes permisos para realizar esta acción.";
};

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const isStaffRole = (value: UserRole | null | undefined): value is Exclude<UserRole, "client"> => {
  return value === "admin" || value === "manager" || value === "employee";
};

export const useAuth = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { resolveUser } = useSessionAccess();

  const profile = useState<Profile | null>("auth:profile", () => null);
  const isLoading = useState<boolean>("auth:is-loading", () => false);
  const isSubmitting = useState<boolean>("auth:is-submitting", () => false);
  const error = useState<string | null>("auth:error", () => null);
  const watcherInitialized = useState<boolean>("auth:watcher-initialized", () => false);
  const profileFetchedForUserId = useState<string | null>(
    "auth:profile:fetched-user-id",
    () => null,
  );
  const profileFetchedAt = useState<number>("auth:profile:fetched-at", () => 0);
  const orgContext = useState<{
    activeOrganizationId: string | null;
    activeOrganizationSlug: string | null;
  }>("auth:org-context", () => ({
    activeOrganizationId: null,
    activeOrganizationSlug: null,
  }));
  const clientProfile = useState<ClientProfileState | null>("auth:client-profile", () => null);
  const clientProfileFetchedForUserId = useState<string | null>("auth:client-profile:fetched-user-id", () => null);
  const clientProfileFetchedForOrgId = useState<string | null>("auth:client-profile:fetched-org-id", () => null);
  const clientProfileFetchedAt = useState<number>("auth:client-profile:fetched-at", () => 0);

  const user = computed<User | null>(() => session.value?.user ?? null);
  const organizationId = computed<string | null>(() => {
    return profile.value?.organization_id ?? getMetadataOrganizationId(user.value);
  });
  const role = computed<UserRole | null>(() => {
    return profile.value?.role ?? getMetadataRole(user.value);
  });
  const activeOrganizationId = computed<string | null>(() => {
    return orgContext.value.activeOrganizationId ?? organizationId.value;
  });
  const resolvedRole = computed<UserRole | "guest">(() => {
    if (isStaffRole(role.value)) {
      return role.value;
    }

    if (role.value === "client" && !activeOrganizationId.value) {
      return "client";
    }

    if (role.value === "client" && clientProfileFetchedForOrgId.value !== activeOrganizationId.value) {
      return "client";
    }

    if (clientProfile.value?.orgStatus === "active") {
      return "client";
    }

    return "guest";
  });

  const setError = (message: string | null) => {
    error.value = message;
  };

  const setActiveOrganization = (payload: {
    organizationId?: string | null;
    organizationSlug?: string | null;
  }) => {
    const nextOrganizationId = sanitizeNullableString(payload.organizationId);
    const nextOrganizationSlug = sanitizeNullableString(payload.organizationSlug);

    orgContext.value = {
      activeOrganizationId: nextOrganizationId,
      activeOrganizationSlug: nextOrganizationSlug,
    };
  };

  const fetchClientProfile = async (
    options: { force?: boolean; organizationId?: string | null } = {},
  ): Promise<ClientProfileState | null> => {
    const currentUser = user.value ?? await resolveUser();
    const nextOrganizationId = sanitizeNullableString(options.organizationId) ?? activeOrganizationId.value;

    if (!currentUser || !nextOrganizationId) {
      clientProfile.value = null;
      clientProfileFetchedForUserId.value = null;
      clientProfileFetchedForOrgId.value = null;
      clientProfileFetchedAt.value = 0;
      return null;
    }

    const forceRefresh = options.force === true;
    const cacheIsFresh =
      clientProfileFetchedForUserId.value === currentUser.id
      && clientProfileFetchedForOrgId.value === nextOrganizationId
      && Date.now() - clientProfileFetchedAt.value < PROFILE_CACHE_TTL_MS;

    if (!forceRefresh && cacheIsFresh) {
      return clientProfile.value;
    }

    try {
      const response = await $fetch<{
        profile: ClientProfileState | null;
      }>("/api/clients/profile", {
        query: {
          organizationId: nextOrganizationId,
        },
      });

      clientProfile.value = response.profile ?? null;
      clientProfileFetchedForUserId.value = currentUser.id;
      clientProfileFetchedForOrgId.value = nextOrganizationId;
      clientProfileFetchedAt.value = Date.now();
      return clientProfile.value;
    } catch {
      clientProfile.value = null;
      clientProfileFetchedForUserId.value = null;
      clientProfileFetchedForOrgId.value = null;
      clientProfileFetchedAt.value = 0;
      return null;
    }
  };

  const useOrgContext = () => ({
    context: readonly(orgContext),
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
  };

  const auditCriticalAction = async (
    action: Database["public"]["Enums"]["audit_action"],
    tableName: string,
    context: AuthAuditContext,
    options: {
      recordId?: string | null;
      oldData?: Record<string, unknown> | null;
      newData?: Record<string, unknown> | null;
    } = {},
  ) => {
    try {
      const userId = user.value?.id ?? null;
      const payload: AuditLogInsert = {
        action,
        table_name: tableName,
        record_id: options.recordId ?? userId,
        user_id: userId,
        old_data: (options.oldData ?? null) as AuditLogInsert["old_data"],
        new_data: (options.newData ?? null) as AuditLogInsert["new_data"],
        context,
      };

      await supabase.from("audit_logs").insert(payload);
    } catch (auditError) {
      const auditMessage =
        auditError instanceof Error ? auditError.message : "Unknown audit error";
      console.error("[AUTH_AUDIT_ERROR]", auditMessage);
    }
  };

  const getProfileQuery = (userId: string | null) => {
    if (!userId) {
      return null;
    }

    // Fetch the profile strictly by the authenticated user id.
    // Relying on auth metadata for organization_id breaks seeded/demo users
    // when that metadata is missing or stale.
    return supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  };

  /**
   * Obtiene el perfil extendido del usuario autenticado desde `profiles`.
   *
   * @example
   * ```ts
   * const { fetchProfile, profile } = useAuth()
   * await fetchProfile()
   * console.log(profile.value?.full_name)
   * ```
   */
  const fetchProfile = async (
    options: { force?: boolean } = {},
  ): Promise<Profile | null> => {
    const currentUser = user.value ?? (await resolveUser());
    if (!currentUser) {
      profile.value = null;
      profileFetchedForUserId.value = null;
      profileFetchedAt.value = 0;
      return null;
    }

    const forceRefresh = options.force === true;
    const cacheIsFresh =
      profileFetchedForUserId.value === currentUser.id &&
      Date.now() - profileFetchedAt.value < PROFILE_CACHE_TTL_MS;

    if (
      !forceRefresh &&
      cacheIsFresh &&
      profile.value &&
      profile.value.id === currentUser.id
    ) {
      return profile.value;
    }

    if (!forceRefresh && isLoading.value) {
      let attempts = 0;
      while (isLoading.value && attempts < 40) {
        await wait(25);
        attempts += 1;
      }

      if (profile.value && profile.value.id === currentUser.id) {
        return profile.value;
      }
    }

    isLoading.value = true;
    setError(null);

    try {
      const query = getProfileQuery(currentUser.id);
      if (!query) {
        profile.value = null;
        return null;
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        throw fetchError;
      }

      profile.value = data ?? null;
      profileFetchedForUserId.value = currentUser.id;
      profileFetchedAt.value = Date.now();
      if (orgContext.value.activeOrganizationId === null && data?.organization_id) {
        orgContext.value.activeOrganizationId = data.organization_id;
      }
      await fetchClientProfile({
        force: forceRefresh,
      });
      return data ?? null;
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "No se pudo cargar el perfil.";
      setError(message);
      profile.value = null;
      profileFetchedForUserId.value = null;
      profileFetchedAt.value = 0;
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Inicia sesión del usuario con email y contraseña.
   *
   * @example
   * ```ts
   * const { signIn, error } = useAuth()
   * await signIn("admin@nexuspos.com", "password123")
   * console.log(error.value)
   * ```
   */
  const signIn = async (
    email: string,
    password: string,
  ): Promise<AuthOperationResult<Session>> => {
    const sanitizedEmail = sanitizeEmail(email);
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

      await fetchProfile();

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
      const message =
        signInError instanceof Error ? signInError.message : "No se pudo iniciar sesión.";
      setError(message);

      return {
        data: null,
        error: message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * Cierra la sesión actual, limpia el estado local y redirige a la ruta de resolución.
   *
   * @example
   * ```ts
   * const { signOut } = useAuth()
   * await signOut()
   * ```
   */
  const signOut = async (): Promise<AuthOperationResult> => {
    isSubmitting.value = true;
    setError(null);

    try {
      const currentUserId = user.value?.id ?? null;

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }

      profile.value = null;
      clientProfile.value = null;
      resetTransientState();

      console.info("[AUTH_SIGN_OUT]", { userId: currentUserId });

      await navigateTo(AUTH_LOGIN_ROUTE);

      return {
        data: null,
        error: null,
      };
    } catch (signOutError) {
      const message =
        signOutError instanceof Error ? signOutError.message : "No se pudo cerrar sesión.";
      setError(message);

      return {
        data: null,
        error: message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * Registra un usuario nuevo con metadata para nombre, rol y organización.
   * Si el registro es público, fuerza el rol `client`.
   *
   * @example
   * ```ts
   * const { signUp } = useAuth()
   * await signUp("client@nexuspos.com", "password123", "Cliente Demo", "client")
   * ```
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    roleInput?: UserRole,
    organizationIdInput?: string | null,
  ): Promise<AuthOperationResult<User>> => {
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizeString(password);
    const sanitizedFullName = sanitizeString(fullName);
    const sanitizedOrganizationId = sanitizeNullableString(organizationIdInput);
    const isPublicRegistration = !sanitizedOrganizationId;
    const sanitizedRole = sanitizeRole(roleInput, isPublicRegistration);

    isSubmitting.value = true;
    setError(null);

    try {
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

      return {
        data: data.user,
        error: null,
      };
    } catch (signUpError) {
      const message =
        signUpError instanceof Error ? signUpError.message : "No se pudo completar el registro.";
      setError(message);

      return {
        data: null,
        error: message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * Actualiza el perfil del usuario autenticado respetando filtros de organización y RLS.
   *
   * @example
   * ```ts
   * const { updateProfile } = useAuth()
   * await updateProfile({ full_name: "Nuevo Nombre", phone: "77777777" })
   * ```
   */
  const updateProfile = async (
    updates: UpdateProfileInput,
  ): Promise<AuthOperationResult<Profile>> => {
    if (!user.value) {
      const message = createPermissionDeniedMessage();
      setError(message);
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
        branch_id:
          typeof updates.branch_id === "string" || updates.branch_id === null
            ? sanitizeNullableString(updates.branch_id)
            : undefined,
      };

      if (sanitizedUpdates.full_name !== undefined && !sanitizedUpdates.full_name) {
        throw new Error("El nombre completo no puede estar vacío.");
      }

      const previousProfile = profile.value;
      let query = supabase
        .from("profiles")
        .update(sanitizedUpdates)
        .eq("id", user.value.id);

      if (organizationId.value) {
        query = query.eq("organization_id", organizationId.value);
      } else {
        query = query.is("organization_id", null);
      }

      const { data, error: updateError } = await query.select().single();
      if (updateError) {
        throw updateError;
      }

      profile.value = data;

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
      const message =
        updateError instanceof Error ? updateError.message : "No se pudo actualizar el perfil.";
      setError(message);

      return {
        data: null,
        error: message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * Envía el email de recuperación de contraseña al usuario.
   *
   * @example
   * ```ts
   * const { resetPassword } = useAuth()
   * await resetPassword("user@nexuspos.com")
   * ```
   */
  const resetPassword = async (email: string): Promise<AuthOperationResult> => {
    const sanitizedEmail = sanitizeEmail(email);

    isSubmitting.value = true;
    setError(null);

    try {
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

      return {
        data: null,
        error: null,
      };
    } catch (resetError) {
      const message =
        resetError instanceof Error
          ? resetError.message
          : "No se pudo enviar el email de recuperación.";
      setError(message);

      return {
        data: null,
        error: message,
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * Verifica si el usuario autenticado posee alguno de los roles permitidos.
   *
   * @example
   * ```ts
   * const { hasRole } = useAuth()
   * const canManage = hasRole(["admin", "manager"])
   * ```
   */
  const hasRole = (roles: UserRole[]): boolean => {
    if (!role.value) {
      return false;
    }

    return roles.includes(role.value);
  };

  /**
   * Verifica si el usuario pertenece a una organización específica.
   *
   * @example
   * ```ts
   * const { isInOrganization } = useAuth()
   * const sameTenant = isInOrganization("org-id")
   * ```
   */
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
      async (userId) => {
        if (!userId) {
          profile.value = null;
          clientProfile.value = null;
          profileFetchedForUserId.value = null;
          profileFetchedAt.value = 0;
          clientProfileFetchedForUserId.value = null;
          clientProfileFetchedForOrgId.value = null;
          clientProfileFetchedAt.value = 0;
          orgContext.value = {
            activeOrganizationId: null,
            activeOrganizationSlug: null,
          };
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
    state,
    resolvedRole,
    activeOrganizationId,
    clientProfile,
    fetchProfile,
    fetchClientProfile,
    signIn,
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
