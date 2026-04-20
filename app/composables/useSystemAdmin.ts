import type { Database, Json } from "@/types/database.types";

export type SystemUserRow = Database["public"]["Tables"]["system_users"]["Row"];
export type SystemUserTable = Database["public"]["Tables"]["system_users"];
type StatsRpcRow =
  Database["public"]["Functions"]["admin_payment_validation_stats"]["Returns"][number];

export interface OrganizationUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  organization_id: string;
  organization_name: string;
  created_at: string;
}

export type OrgUserEmailAction = "confirm" | "resend";
export type UserAccountScope = "organization" | "client";

export interface ClientUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface SystemDashboardStats {
  pendingValidations: number;
  approvedToday: number;
  rejectedToday: number;
  totalSystemUsers: number;
  activeSystemUsers: number;
  totalOrganizations: number;
}

export interface SystemDashboardAlert {
  id: string;
  title: string;
  description: string;
  severity: "warning" | "info" | "success";
}

export interface SystemUserFormInput {
  userId?: string;
  email: string;
  fullName: string;
  password?: string | null;
  role: string;
  isActive: boolean;
}

export type SystemPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type SystemRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type RoleModulePermissionRow = Database["public"]["Tables"]["role_module_permissions"]["Row"];

export interface SystemRoleWithPermissions extends SystemRoleRow {
  module_permissions: RoleModulePermissionRow[];
}

export interface SystemPlanFormInput {
  id?: string;
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  businessOnly: boolean;
  description: string;
  resume: string;
  features: Json;
  permissions: Json;
  limits: Json;
  availableBillingModes: Json;
  trial: boolean;
  trialDuration: number | null;
  maxBranches: number;
  maxUsers: number;
  isActive: boolean;
}

const createDefaultStats = (): SystemDashboardStats => ({
  pendingValidations: 0,
  approvedToday: 0,
  rejectedToday: 0,
  totalSystemUsers: 0,
  activeSystemUsers: 0,
  totalOrganizations: 0,
});

const createDefaultAlerts = (): SystemDashboardAlert[] => [];

export const useSystemAdmin = () => {
  const supabase = useSupabaseClient<Database>();
  const systemUsersTable = supabase.from<"system_users", SystemUserTable>(
    "system_users",
  );
  const session = useSupabaseSession();

  const stats = useState<SystemDashboardStats>(
    "system:dashboard:stats",
    createDefaultStats,
  );
  const alerts = useState<SystemDashboardAlert[]>(
    "system:dashboard:alerts",
    createDefaultAlerts,
  );
  const systemUsers = useState<SystemUserRow[]>(
    "system:dashboard:users",
    () => [],
  );
  const totalSystemUsers = useState<number>(
    "system:dashboard:users:total",
    () => 0,
  );
  const orgUsers = useState<OrganizationUser[]>(
    "system:dashboard:org-users",
    () => [],
  );
  const totalOrgUsers = useState<number>(
    "system:dashboard:org-users:total",
    () => 0,
  );
  const clients = useState<ClientUser[]>("system:dashboard:clients", () => []);
  const totalClients = useState<number>(
    "system:dashboard:clients:total",
    () => 0,
  );
  const dashboardLoading = useState<boolean>(
    "system:dashboard:loading",
    () => false,
  );
  const usersLoading = useState<boolean>(
    "system:dashboard:users:loading",
    () => false,
  );
  const orgUsersLoading = useState<boolean>(
    "system:dashboard:org-users:loading",
    () => false,
  );
  const clientsLoading = useState<boolean>(
    "system:dashboard:clients:loading",
    () => false,
  );
  const actionLoading = useState<boolean>(
    "system:dashboard:users:action-loading",
    () => false,
  );
  const plans = useState<SystemPlanRow[]>("system:plans:rows", () => []);
  const plansLoading = useState<boolean>("system:plans:loading", () => false);
  const roles = useState<SystemRoleWithPermissions[]>("system:roles:rows", () => []);
  const rolesLoading = useState<boolean>("system:roles:loading", () => false);
  const error = useState<string | null>("system:dashboard:error", () => null);

  const getReadableErrorMessage = (
    source: unknown,
    fallback: string,
  ): string => {
    if (!source || typeof source !== "object") {
      return fallback;
    }

    const err = source as {
      message?: string;
      statusMessage?: string;
      data?: {
        message?: string;
        statusMessage?: string;
      };
    };

    const candidate =
      err.data?.statusMessage ??
      err.data?.message ??
      err.statusMessage ??
      err.message;

    if (!candidate) {
      return fallback;
    }

    return candidate.replace(/^\[[A-Z]+\]\s+"[^"]+":\s*/u, "").trim();
  };

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
      throw new Error("No se encontro una sesion valida para operaciones system.");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadPaymentStats = async (): Promise<void> => {
    const { data, error: statsError } = await supabase.rpc(
      "admin_payment_validation_stats",
    );

    if (statsError) {
      throw statsError;
    }

    const row: StatsRpcRow | null = Array.isArray(data)
      ? (data[0] ?? null)
      : null;

    stats.value = {
      pendingValidations: row?.pending_count ?? 0,
      approvedToday: row?.approved_today ?? 0,
      rejectedToday: row?.rejected_today ?? 0,
      totalSystemUsers: stats.value.totalSystemUsers,
      activeSystemUsers: stats.value.activeSystemUsers,
      totalOrganizations: stats.value.totalOrganizations,
    };
  };

  const loadSystemUserCounts = async (): Promise<void> => {
    const [
      { count: totalCount, error: totalError },
      { count: activeCount, error: activeError },
    ] = await Promise.all([
      systemUsersTable.select("user_id", { count: "exact", head: true }),
      systemUsersTable
        .select("user_id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (totalError || activeError) {
      throw totalError ?? activeError;
    }

    stats.value = {
      ...stats.value,
      totalSystemUsers: Number(totalCount ?? 0),
      activeSystemUsers: Number(activeCount ?? 0),
    };
  };

  const loadOrganizationCount = async (): Promise<void> => {
    const { count, error: orgError } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (orgError) {
      throw orgError;
    }

    stats.value = {
      ...stats.value,
      totalOrganizations: Number(count ?? 0),
    };
  };

  const buildAlerts = () => {
    const nextAlerts: SystemDashboardAlert[] = [];

    if (stats.value.pendingValidations > 0) {
      nextAlerts.push({
        id: "pending-validations",
        title: `${stats.value.pendingValidations} validacion(es) pendientes`,
        description:
          "Revisa los comprobantes nuevos antes de activar organizaciones.",
        severity: "warning",
      });
    }

    if (stats.value.rejectedToday > 0) {
      nextAlerts.push({
        id: "rejected-today",
        title: `${stats.value.rejectedToday} pago(s) rechazado(s) hoy`,
        description:
          "Asegurate de contactar al cliente para corregir el comprobante.",
        severity: "info",
      });
    }

    if (stats.value.totalSystemUsers === 0) {
      nextAlerts.push({
        id: "no-system-users",
        title: "No hay usuarios system registrados",
        description:
          "Agrega un usuario system para habilitar el acceso a la plataforma.",
        severity: "warning",
      });
    }

    if (stats.value.totalOrganizations === 0) {
      nextAlerts.push({
        id: "no-organizations",
        title: "Sin organizaciones activas",
        description: "No hay organizaciones registradas en la plataforma.",
        severity: "info",
      });
    }

    alerts.value =
      nextAlerts.length > 0
        ? nextAlerts
        : [
            {
              id: "healthy",
              title: "Sin alertas urgentes",
              description:
                "El sistema no detecta eventos críticos en este momento.",
              severity: "success",
            },
          ];
  };

  const loadDashboard = async (): Promise<void> => {
    dashboardLoading.value = true;
    error.value = null;

    try {
      await Promise.all([
        loadPaymentStats(),
        loadSystemUserCounts(),
        loadOrganizationCount(),
      ]);
      buildAlerts();
    } catch (loadError) {
      error.value = getReadableErrorMessage(
        loadError,
        "No pudimos cargar las metricas del dashboard.",
      );
    } finally {
      dashboardLoading.value = false;
    }
  };

  const loadSystemUsers = async (page = 1, perPage = 20): Promise<void> => {
    usersLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        total: number;
        rows: SystemUserRow[];
      }>("/api/system/users", {
        headers: await getSystemRequestHeaders(),
        query: {
          page,
          perPage,
        },
      });

      systemUsers.value = response.rows ?? [];
      totalSystemUsers.value = Number(response.total ?? 0);
    } catch (loadError) {
      error.value = getReadableErrorMessage(
        loadError,
        "No pudimos cargar los usuarios system.",
      );
      systemUsers.value = [];
      totalSystemUsers.value = 0;
    } finally {
      usersLoading.value = false;
    }
  };

  const loadOrgUsers = async (page = 1, perPage = 10): Promise<void> => {
    orgUsersLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        total: number;
        rows: OrganizationUser[];
      }>("/api/system/users/organizations", {
        headers: await getSystemRequestHeaders(),
        query: {
          page,
          perPage,
        },
      });

      orgUsers.value = response.rows;
      totalOrgUsers.value = Number(response.total ?? 0);
    } catch (loadError) {
      error.value = getReadableErrorMessage(
        loadError,
        "No pudimos cargar los usuarios de organizaciones.",
      );
      orgUsers.value = [];
      totalOrgUsers.value = 0;
    } finally {
      orgUsersLoading.value = false;
    }
  };

  const loadClients = async (page = 1, perPage = 10): Promise<void> => {
    clientsLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        total: number;
        rows: ClientUser[];
      }>("/api/system/users/clients", {
        headers: await getSystemRequestHeaders(),
        query: {
          page,
          perPage,
        },
      });

      clients.value = response.rows;
      totalClients.value = Number(response.total ?? 0);
    } catch (loadError) {
      error.value = getReadableErrorMessage(
        loadError,
        "No pudimos cargar los usuarios clientes.",
      );
      clients.value = [];
      totalClients.value = 0;
    } finally {
      clientsLoading.value = false;
    }
  };

  const triggerOrgUserEmailAction = async (
    userId: string,
    action: OrgUserEmailAction,
  ): Promise<{ success: true; action: OrgUserEmailAction; userId: string; message: string }> => {
    actionLoading.value = true;
    error.value = null;

    try {
      return await $fetch(`/api/system/users/${userId}/email`, {
        method: "POST",
        headers: await getSystemRequestHeaders(),
        body: { action },
      });
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos ejecutar la accion de email para el usuario.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const confirmOrgUserEmail = async (userId: string) => {
    const response = await triggerOrgUserEmailAction(userId, "confirm");
    const index = orgUsers.value.findIndex((entry) => entry.id === userId);
    if (index >= 0) {
      orgUsers.value[index] = {
        ...orgUsers.value[index]!,
        email_verified: true,
      };
    }

    return response;
  };

  const resendOrgUserEmail = async (userId: string) => {
    return await triggerOrgUserEmailAction(userId, "resend");
  };

  const setScopedUserStatus = async (
    userId: string,
    scope: UserAccountScope,
    isActive: boolean,
  ): Promise<{ success: true; action: "set_status"; userId: string; isActive: boolean; message: string }> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: true;
        action: "set_status";
        userId: string;
        isActive: boolean;
        message: string;
      }>(`/api/system/users/${userId}/account`, {
        method: "PATCH",
        headers: await getSystemRequestHeaders(),
        body: {
          scope,
          action: "set_status",
          isActive,
        },
      });

      if (scope === "organization") {
        const index = orgUsers.value.findIndex((entry) => entry.id === userId);
        if (index >= 0) {
          orgUsers.value[index] = {
            ...orgUsers.value[index]!,
            is_active: response.isActive,
          };
        }
      } else {
        const index = clients.value.findIndex((entry) => entry.id === userId);
        if (index >= 0) {
          clients.value[index] = {
            ...clients.value[index]!,
            is_active: response.isActive,
          };
        }
      }

      return response;
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos actualizar el estado del usuario.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const resetScopedUserPassword = async (
    userId: string,
    scope: UserAccountScope,
  ): Promise<{ success: true; action: "reset_password"; userId: string; temporaryPassword: string; message: string }> => {
    actionLoading.value = true;
    error.value = null;

    try {
      return await $fetch<{
        success: true;
        action: "reset_password";
        userId: string;
        temporaryPassword: string;
        message: string;
      }>(`/api/system/users/${userId}/account`, {
        method: "PATCH",
        headers: await getSystemRequestHeaders(),
        body: {
          scope,
          action: "reset_password",
        },
      });
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos resetear la contrasena del usuario.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const createSystemUser = async (
    input: SystemUserFormInput,
  ): Promise<SystemUserRow> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ row: SystemUserRow }>(
        "/api/system/users",
        {
          method: "POST",
          headers: await getSystemRequestHeaders(),
          body: {
            email: input.email,
            fullName: input.fullName,
            password: input.password,
            role: input.role,
            isActive: input.isActive,
          },
        },
      );

      if (response.row) {
        systemUsers.value = [response.row, ...systemUsers.value];
        totalSystemUsers.value += 1;
      }

      return response.row;
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos crear el usuario system.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const updateSystemUser = async (
    input: SystemUserFormInput,
  ): Promise<SystemUserRow | null> => {
    actionLoading.value = true;
    error.value = null;

    try {
      if (!input.userId) {
        throw new Error("No se encontro el ID del usuario a editar.");
      }

      const response = await $fetch<{ row: SystemUserRow }>(
        `/api/system/users/${input.userId}`,
        {
          method: "PATCH",
          headers: await getSystemRequestHeaders(),
          body: {
            email: input.email,
            fullName: input.fullName,
            password: input.password,
            role: input.role,
            isActive: input.isActive,
          },
        },
      );

      if (response.row) {
        const currentIndex = systemUsers.value.findIndex(
          (item: SystemUserRow) => item.user_id === response.row.user_id,
        );
        if (currentIndex >= 0) {
          systemUsers.value.splice(currentIndex, 1, response.row);
        }
      }

      return response.row;
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos actualizar el usuario system.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const toggleSystemUserStatus = async (
    userId: string,
    active: boolean,
  ): Promise<void> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ row: SystemUserRow }>(
        `/api/system/users/${userId}/status`,
        {
          method: "PATCH",
          headers: await getSystemRequestHeaders(),
          body: {
            isActive: active,
          },
        },
      );

      if (response.row) {
        const currentIndex = systemUsers.value.findIndex(
          (item: SystemUserRow) => item.user_id === response.row.user_id,
        );
        if (currentIndex >= 0) {
          systemUsers.value.splice(currentIndex, 1, response.row);
        }
      }
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos cambiar el estado del usuario.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const getDefaultSystemUserForm = (): SystemUserFormInput => ({
    email: "",
    fullName: "",
    password: "",
    role: "system",
    isActive: true,
  });

  const getDefaultPlanForm = (): SystemPlanFormInput => ({
    slug: "",
    name: "",
    priceMonthly: 0,
    priceYearly: 0,
    businessOnly: false,
    description: "",
    resume: "",
    features: [],
    permissions: {},
    limits: {},
    availableBillingModes: {
      monthly: { label: "monthly", enabled: true, discount_percent: 10 },
      quarterly: { label: "quarterly", enabled: true, discount_percent: 15 },
      annual: { label: "annual", enabled: true, discount_percent: 20 },
    },
    trial: false,
    trialDuration: null,
    maxBranches: 1,
    maxUsers: 1,
    isActive: true,
  });

  const loadPlans = async (): Promise<void> => {
    plansLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ rows: SystemPlanRow[] }>("/api/system/plans", {
        headers: await getSystemRequestHeaders(),
      });

      plans.value = response.rows ?? [];
    } catch (loadError) {
      error.value = getReadableErrorMessage(
        loadError,
        "No pudimos cargar los planes.",
      );
      plans.value = [];
    } finally {
      plansLoading.value = false;
    }
  };

  const createPlan = async (input: SystemPlanFormInput): Promise<SystemPlanRow> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ row: SystemPlanRow }>("/api/system/plans", {
        method: "POST",
        headers: await getSystemRequestHeaders(),
        body: {
          slug: input.slug,
          name: input.name,
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly,
          businessOnly: input.businessOnly,
          description: input.description,
          resume: input.resume,
          features: input.features,
          permissions: input.permissions,
          limits: input.limits,
          availableBillingModes: input.availableBillingModes,
          trial: input.trial,
          trialDuration: input.trialDuration,
          maxBranches: input.maxBranches,
          maxUsers: input.maxUsers,
          isActive: input.isActive,
        },
      });

      if (response.row) {
        plans.value = [...plans.value, response.row];
      }

      return response.row;
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos crear el plan.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const updatePlan = async (
    planId: string,
    input: Partial<SystemPlanFormInput>,
  ): Promise<SystemPlanRow> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ row: SystemPlanRow }>(`/api/system/plans/${planId}`, {
        method: "PATCH",
        headers: await getSystemRequestHeaders(),
        body: {
          name: input.name,
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly,
          businessOnly: input.businessOnly,
          description: input.description,
          resume: input.resume,
          features: input.features,
          permissions: input.permissions,
          limits: input.limits,
          availableBillingModes: input.availableBillingModes,
          trial: input.trial,
          trialDuration: input.trialDuration,
          maxBranches: input.maxBranches,
          maxUsers: input.maxUsers,
          isActive: input.isActive,
        },
      });

      if (response.row) {
        const index = plans.value.findIndex((plan) => plan.id === response.row.id);
        if (index >= 0) {
          plans.value.splice(index, 1, response.row);
        }
      }

      return response.row;
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos actualizar el plan.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const loadRoles = async (): Promise<void> => {
    rolesLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ rows: SystemRoleWithPermissions[] }>("/api/system/roles", {
        headers: await getSystemRequestHeaders(),
      });

      roles.value = response.rows ?? [];
    } catch (loadError) {
      error.value = getReadableErrorMessage(
        loadError,
        "No pudimos cargar los roles globales.",
      );
      roles.value = [];
    } finally {
      rolesLoading.value = false;
    }
  };

  const updateRole = async (
    roleId: string,
    payload: { name: string; description: string; isActive: boolean },
  ): Promise<SystemRoleRow> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ row: SystemRoleRow }>(`/api/system/roles/${roleId}`, {
        method: "PATCH",
        headers: await getSystemRequestHeaders(),
        body: payload,
      });

      const current = roles.value.find((role) => role.id === roleId);
      if (response.row && current) {
        Object.assign(current, response.row);
      }

      return response.row;
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos actualizar el rol.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  const updateRolePermissions = async (
    roleId: string,
    permissions: Array<{
      moduleKey: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canExport: boolean;
      canManage: boolean;
      canApprove: boolean;
      canAssign: boolean;
    }>,
  ): Promise<RoleModulePermissionRow[]> => {
    actionLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ rows: RoleModulePermissionRow[] }>(
        `/api/system/roles/${roleId}/permissions`,
        {
          method: "PUT",
          headers: await getSystemRequestHeaders(),
          body: { permissions },
        },
      );

      const role = roles.value.find((entry) => entry.id === roleId);
      if (role) {
        role.module_permissions = response.rows ?? [];
      }

      return response.rows ?? [];
    } catch (requestError) {
      error.value = getReadableErrorMessage(
        requestError,
        "No pudimos actualizar permisos del rol.",
      );
      throw requestError;
    } finally {
      actionLoading.value = false;
    }
  };

  return {
    stats,
    alerts,
    systemUsers,
    totalSystemUsers,
    orgUsers,
    totalOrgUsers,
    clients,
    totalClients,
    dashboardLoading,
    usersLoading,
    orgUsersLoading,
    clientsLoading,
    plans,
    plansLoading,
    roles,
    rolesLoading,
    actionLoading,
    error,
    loadDashboard,
    loadSystemUsers,
    loadOrgUsers,
    loadClients,
    confirmOrgUserEmail,
    resendOrgUserEmail,
    setScopedUserStatus,
    resetScopedUserPassword,
    loadPlans,
    loadRoles,
    createSystemUser,
    updateSystemUser,
    toggleSystemUserStatus,
    createPlan,
    updatePlan,
    updateRole,
    updateRolePermissions,
    getDefaultSystemUserForm,
    getDefaultPlanForm,
  };
};
