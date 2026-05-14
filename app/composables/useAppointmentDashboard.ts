export type AppointmentDashboardScopeRole = "admin" | "manager" | "employee";

export interface AppointmentDashboardDailyStats {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface AppointmentDashboardEmployee {
  id: string;
  fullName: string;
  appointmentCount: number;
}

export interface AppointmentDashboardResult {
  daily: {
    date: string;
    stats: AppointmentDashboardDailyStats;
    occupancyPercent: number;
    estimatedRevenue: number;
    totalSlots: number;
    occupiedSlots: number;
  };
  topEmployees: AppointmentDashboardEmployee[];
  weeklyNoShow: {
    total: number;
    noShowCount: number;
    noShowPercent: number;
    startDate: string;
    endDate: string;
  };
}

export const useAppointmentDashboard = () => {
  const { profile } = useAuth();
  const { resolveAccessToken } = useSessionAccess();

  const toAuthHeaders = (accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
  });

  const loadDashboard = async (
    date: string,
    scopeRole: AppointmentDashboardScopeRole,
    currentProfileId: string,
    managerBranchId: string | null,
  ): Promise<AppointmentDashboardResult> => {
    const token = await resolveAccessToken();
    if (!token) {
      throw new Error("No se pudo obtener el token de autenticacion.");
    }

    return $fetch<AppointmentDashboardResult>("/api/appointments/dashboard", {
      headers: toAuthHeaders(token),
      query: {
        date,
        scopeRole,
        currentProfileId,
        managerBranchId: managerBranchId ?? undefined,
      },
    });
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", minimumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: number): string => {
    return `${value}%`;
  };

  const getManagerBranchId = computed(() => {
    if (profile.value?.role === "manager") {
      return (profile.value as any).primary_branch_id ?? null;
    }
    return null;
  });

  const scopeRole = computed<"admin" | "manager" | "employee">(() => {
    const role = profile.value?.role;
    if (role === "admin") return "admin";
    if (role === "manager") return "manager";
    return "employee";
  });

  return {
    loadDashboard,
    formatCurrency,
    formatPercent,
    getManagerBranchId,
    scopeRole,
  };
};
