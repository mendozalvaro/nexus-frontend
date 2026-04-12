import type { Database } from "@/types/database.types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type UserRole = Database["public"]["Enums"]["user_role"];

export type AppointmentScopeRole = "manager" | "employee" | "client";
export type AppointmentCalendarView = "day" | "week" | "month";
export type ReminderChannel = "email" | "sms";

export interface AppointmentOption {
  label: string;
  value: string;
}

export interface AppointmentServiceOption extends AppointmentOption {
  durationMinutes: number;
  price: number;
}

export interface AppointmentEmployeeOption extends AppointmentOption {
  branchId: string | null;
  assignedBranchIds: string[];
  serviceIdsByBranch: Record<string, string[]>;
  role: UserRole;
}

export interface AppointmentBranchOption extends AppointmentOption {
  code: string;
  address: string | null;
}

export interface AppointmentListItem {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  serviceId: string;
  serviceName: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  isWalkIn: boolean;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes: string | null;
  cancellationReason: string | null;
}

export interface AppointmentCatalog {
  organizationId: string;
  branches: AppointmentBranchOption[];
  services: AppointmentServiceOption[];
  employees: AppointmentEmployeeOption[];
}

export interface AppointmentFilters {
  view: AppointmentCalendarView;
  anchorDate: string;
  branchId: string | null;
  employeeId: string | null;
  serviceId: string | null;
  status: AppointmentStatus | "all";
}

export interface AppointmentWalkInPayload {
  fullName: string;
  phone: string;
  notes?: string;
}

export interface AppointmentMutationPayload {
  branchId: string;
  serviceId: string;
  employeeId: string;
  date: string;
  startTimeLocal: string;
  notes: string;
  reminderChannels: ReminderChannel[];
  walkIn?: AppointmentWalkInPayload | null;
}

export interface AppointmentStatusPayload {
  status: "in_progress" | "completed";
}

export interface AppointmentRange {
  startIso: string;
  endIso: string;
}

interface AppointmentCatalogResponse {
  organizationId: string;
  branches: BranchRow[];
  services: ServiceRow[];
  employees: Array<ProfileRow & {
    assignedBranchIds?: string[];
    serviceIdsByBranch?: Record<string, string[]>;
  }>;
}

const statusOrder: Array<AppointmentStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

export const appointmentStatusOptions: Array<{ label: string; value: AppointmentStatus | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Pendiente", value: "pending" },
  { label: "Confirmada", value: "confirmed" },
  { label: "En proceso", value: "in_progress" },
  { label: "Completada", value: "completed" },
  { label: "Cancelada", value: "cancelled" },
  { label: "No asistió", value: "no_show" },
];

export const appointmentViewOptions: Array<{ label: string; value: AppointmentCalendarView }> = [
  { label: "Día", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mes", value: "month" },
];

const sortStatuses = (left: AppointmentStatus | "all", right: AppointmentStatus | "all") => {
  return statusOrder.indexOf(left) - statusOrder.indexOf(right);
};

const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (value: Date): Date => {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
};

const endOfLocalDay = (value: Date): Date => {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
};

const parseDateInput = (value: string): Date => {
  return new Date(`${value}T00:00:00`);
};

const addDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const toDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const readStatus = (value: AppointmentRow["status"]): AppointmentStatus => value ?? "pending";

const toAppointmentBranchOption = (branch: BranchRow): AppointmentBranchOption => ({
  label: branch.name,
  value: branch.id,
  code: branch.code,
  address: branch.address,
});

const toAppointmentServiceOption = (service: ServiceRow): AppointmentServiceOption => ({
  label: service.name,
  value: service.id,
  durationMinutes: service.duration_minutes,
  price: service.price,
});

const toAppointmentEmployeeOption = (
  profile: ProfileRow & {
    assignedBranchIds?: string[];
    serviceIdsByBranch?: Record<string, string[]>;
  },
): AppointmentEmployeeOption => ({
  label: profile.full_name,
  value: profile.id,
  branchId: profile.branch_id,
  assignedBranchIds: profile.assignedBranchIds ?? [],
  serviceIdsByBranch: "serviceIdsByBranch" in profile && profile.serviceIdsByBranch
    ? profile.serviceIdsByBranch
    : {},
  role: profile.role ?? "employee",
});

const parseServiceSkills = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const toAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const useAppointments = () => {
  const supabase = useSupabaseClient<Database>();
  const { resolveAccessToken } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const ensureProfile = async () => {
    return profile.value ?? await fetchProfile();
  };

  const getAccessToken = async (): Promise<string> => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesión no está disponible para gestionar la agenda.",
      });
    }

    return token;
  };

  const getDateRange = (view: AppointmentCalendarView, anchorDate: string): AppointmentRange => {
    const anchor = parseDateInput(anchorDate);

    if (view === "day") {
      return {
        startIso: startOfLocalDay(anchor).toISOString(),
        endIso: endOfLocalDay(anchor).toISOString(),
      };
    }

    if (view === "week") {
      const dayOfWeek = anchor.getDay();
      const delta = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const start = startOfLocalDay(addDays(anchor, delta));
      const end = endOfLocalDay(addDays(start, 6));

      return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      };
    }

    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  };

  const formatDateTime = (value: string, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: localTimeZone,
      ...(options ?? {}),
    }).format(new Date(value));
  };

  const formatTimeRange = (startTime: string, endTime: string) => {
    const formatter = new Intl.DateTimeFormat("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: localTimeZone,
    });

    return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
  };

  const getAppointmentColor = (status: AppointmentStatus): "primary" | "warning" | "success" | "error" | "neutral" => {
    switch (status) {
      case "pending":
        return "warning";
      case "confirmed":
        return "primary";
      case "in_progress":
        return "warning";
      case "completed":
        return "success";
      case "cancelled":
      case "no_show":
        return "error";
      default:
        return "neutral";
    }
  };

  const getAppointmentStatusLabel = (status: AppointmentStatus): string => {
    return appointmentStatusOptions.find((option) => option.value === status)?.label ?? status;
  };

  const loadCatalog = async (scopeRole: AppointmentScopeRole): Promise<AppointmentCatalog> => {
    const currentProfile = await ensureProfile();
    if (!currentProfile) {
      throw createError({
        statusCode: 401,
        statusMessage: "No se pudo cargar el perfil asociado a la agenda.",
      });
    }

    if (scopeRole === "client") {
      const response = await $fetch<AppointmentCatalogResponse>("/api/appointments/client-catalog", {
        headers: toAuthHeaders(await getAccessToken()),
      });

      return {
        organizationId: response.organizationId,
        branches: response.branches.map(toAppointmentBranchOption),
        services: response.services.map(toAppointmentServiceOption),
        employees: response.employees.map(toAppointmentEmployeeOption),
      };
    }

    if (!currentProfile.organization_id) {
      throw createError({
        statusCode: 403,
        statusMessage: "No se encontró la organización asociada a tu perfil.",
      });
    }

    const organizationId = currentProfile.organization_id;

    const [{ data: branches, error: branchesError }, { data: services, error: servicesError }, { data: employees, error: employeesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
      supabase
        .from("branches")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("services")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("role", ["admin", "manager", "employee"])
        .order("full_name", { ascending: true }),
      supabase
        .from("employee_branch_assignments")
        .select("user_id, branch_id, skills"),
    ]);

    const firstError = branchesError ?? servicesError ?? employeesError ?? assignmentsError;
    if (firstError) {
      throw createError({
        statusCode: 500,
        statusMessage: firstError.message,
      });
    }

    const branchOptions = (branches ?? []).map(toAppointmentBranchOption);
    const assignmentsByEmployee = new Map<string, string[]>();
    const serviceCoverageByEmployee = new Map<string, Record<string, string[]>>();
    for (const assignment of assignments ?? []) {
      const current = assignmentsByEmployee.get(assignment.user_id) ?? [];
      current.push(assignment.branch_id);
      assignmentsByEmployee.set(assignment.user_id, current);

      const currentCoverage = serviceCoverageByEmployee.get(assignment.user_id) ?? {};
      currentCoverage[assignment.branch_id] = parseServiceSkills(assignment.skills);
      serviceCoverageByEmployee.set(assignment.user_id, currentCoverage);
    }

    const employeeOptions = (employees ?? []).map((employee) => toAppointmentEmployeeOption({
      ...employee,
      assignedBranchIds: Array.from(new Set(assignmentsByEmployee.get(employee.id) ?? [])),
      serviceIdsByBranch: serviceCoverageByEmployee.get(employee.id) ?? {},
    }));

    const filteredBranches = scopeRole === "manager" && currentProfile.branch_id
      ? branchOptions.filter((branch) => branch.value === currentProfile.branch_id)
      : branchOptions;

    const managerBranchId = currentProfile.branch_id;
    const filteredEmployees = scopeRole === "manager" && managerBranchId
      ? employeeOptions.filter((employee) => employee.branchId === managerBranchId || employee.assignedBranchIds.includes(managerBranchId))
      : scopeRole === "employee"
        ? employeeOptions.filter((employee) => employee.value === currentProfile.id)
        : employeeOptions;

    return {
      organizationId,
      branches: filteredBranches,
      services: (services ?? []).map(toAppointmentServiceOption),
      employees: filteredEmployees,
    };
  };

  const loadAppointments = async (
    scopeRole: AppointmentScopeRole,
    filters: AppointmentFilters,
  ): Promise<{ appointments: AppointmentListItem[]; catalog: AppointmentCatalog }> => {
    const currentProfile = await ensureProfile();
    if (!currentProfile) {
      throw createError({
        statusCode: 401,
        statusMessage: "No se pudo cargar el perfil asociado a la agenda.",
      });
    }

    const catalog = await loadCatalog(scopeRole);
    const { startIso, endIso } = getDateRange(filters.view, filters.anchorDate);

    let query = supabase
      .from("appointments")
      .select("*")
      .eq("organization_id", catalog.organizationId)
      .gte("start_time", startIso)
      .lte("start_time", endIso)
      .order("start_time", { ascending: true });

    if (filters.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }

    if (filters.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }

    if (filters.serviceId) {
      query = query.eq("service_id", filters.serviceId);
    }

    if (filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (scopeRole === "manager" && currentProfile.branch_id) {
      query = query.eq("branch_id", currentProfile.branch_id);
    }

    if (scopeRole === "employee") {
      query = query.eq("employee_id", currentProfile.id);
    }

    if (scopeRole === "client") {
      query = query.eq("customer_id", currentProfile.id);
    }

    const { data: appointments, error: appointmentsError } = await query.returns<AppointmentRow[]>();

    if (appointmentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: appointmentsError.message,
      });
    }

    const rows = appointments ?? [];
    const branchMap = new Map(catalog.branches.map((branch) => [branch.value, branch]));
    const serviceMap = new Map(catalog.services.map((service) => [service.value, service]));
    const employeeMap = new Map(catalog.employees.map((employee) => [employee.value, employee]));

    const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter((value): value is string => Boolean(value))));
    const customerLookup = new Map<string, Pick<ProfileRow, "id" | "full_name" | "phone">>();

    if (customerIds.length > 0) {
      const { data: customers, error: customersError } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", customerIds);

      if (customersError) {
        throw createError({
          statusCode: 500,
          statusMessage: customersError.message,
        });
      }

      for (const customer of customers ?? []) {
        customerLookup.set(customer.id, customer);
      }
    }

    return {
      catalog,
      appointments: rows.map((row) => {
        const customer = row.customer_id ? customerLookup.get(row.customer_id) : null;

        return {
          id: row.id,
          organizationId: row.organization_id,
          branchId: row.branch_id,
          branchName: branchMap.get(row.branch_id)?.label ?? "Sucursal",
          employeeId: row.employee_id,
          employeeName: employeeMap.get(row.employee_id)?.label ?? "Equipo",
          serviceId: row.service_id,
          serviceName: serviceMap.get(row.service_id)?.label ?? "Servicio",
          customerId: row.customer_id,
          customerName: customer?.full_name ?? row.customer_name ?? "Cliente temporal",
          customerPhone: customer?.phone ?? row.customer_phone,
          isWalkIn: !row.customer_id && Boolean(row.customer_name),
          startTime: row.start_time,
          endTime: row.end_time,
          status: readStatus(row.status),
          notes: row.notes,
          cancellationReason: row.cancellation_reason,
        };
      }),
    };
  };

  const createAppointment = async (payload: AppointmentMutationPayload) => {
    return await $fetch<{ success: boolean; appointmentId: string }>("/api/appointments", {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const updateAppointment = async (appointmentId: string, payload: AppointmentMutationPayload & { status?: "pending" | "confirmed" }) => {
    return await $fetch<{ success: boolean; appointmentId: string }>(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const cancelAppointment = async (appointmentId: string, reason: string) => {
    return await $fetch<{ success: boolean; appointmentId: string }>(`/api/appointments/${appointmentId}/cancel`, {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: { reason },
    });
  };

  const updateAppointmentStatus = async (appointmentId: string, payload: AppointmentStatusPayload) => {
    return await $fetch<{ success: boolean; appointmentId: string; status: AppointmentStatus }>(`/api/appointments/${appointmentId}/status`, {
      method: "POST",
      headers: toAuthHeaders(await getAccessToken()),
      body: payload,
    });
  };

  const createDefaultFilters = (): AppointmentFilters => ({
    view: "week",
    anchorDate: getTodayDate(),
    branchId: null,
    employeeId: null,
    serviceId: null,
    status: "all",
  });

  const toFormPayloadFromAppointment = (appointment: AppointmentListItem): AppointmentMutationPayload => ({
    branchId: appointment.branchId,
    serviceId: appointment.serviceId,
    employeeId: appointment.employeeId,
    date: toDateInput(new Date(appointment.startTime)),
    startTimeLocal: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: localTimeZone,
    }).format(new Date(appointment.startTime)),
    notes: appointment.notes ?? "",
    reminderChannels: [],
    walkIn: appointment.isWalkIn
      ? {
          fullName: appointment.customerName,
          phone: appointment.customerPhone ?? "",
          notes: "",
        }
      : null,
  });

  return {
    appointmentStatusOptions: [...appointmentStatusOptions].sort((left, right) => sortStatuses(left.value, right.value)),
    appointmentViewOptions,
    localTimeZone,
    createDefaultFilters,
    getDateRange,
    formatDateTime,
    formatTimeRange,
    getAppointmentColor,
    getAppointmentStatusLabel,
    loadCatalog,
    loadAppointments,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    toFormPayloadFromAppointment,
    getTodayDate,
  };
};
