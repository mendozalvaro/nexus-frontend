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
  organization_id: string;
  organization_name: string;
  created_at: string;
}

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
  permissions: Json;
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

  const parsePermissions = (value: string): Json => {
    try {
      return JSON.parse(value);
    } catch (parseError) {
      throw parseError;
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
            permissions: input.permissions,
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
            permissions: input.permissions,
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
    permissions: [],
    isActive: true,
  });

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
    actionLoading,
    error,
    loadDashboard,
    loadSystemUsers,
    loadOrgUsers,
    loadClients,
    createSystemUser,
    updateSystemUser,
    toggleSystemUserStatus,
    getDefaultSystemUserForm,
    parsePermissions,
  };
};
