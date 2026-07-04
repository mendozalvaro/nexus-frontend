import { requireAppointmentContextStrict } from "../../utils/appointments";

import type { Database } from "@/types/database.types";

import type { H3Event } from "h3";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

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
  transactionId: string | null;
}

export interface AppointmentFilters {
  view: "day" | "week" | "month";
  anchorDate: string;
  branchId: string | null;
  employeeId: string | null;
  serviceId: string | null;
  status: AppointmentStatus | "all";
  scopeRole: "admin" | "manager" | "employee" | "client";
  currentProfileId: string;
  managerBranchId: string | null;
}

export interface AppointmentsListResult {
  appointments: AppointmentListItem[];
}

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

const getDateRange = (view: "day" | "week" | "month", anchorDate: string): { startIso: string; endIso: string } => {
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

const readStatus = (value: AppointmentRow["status"]): AppointmentStatus => value ?? "pending";

export async function getAppointmentsList(
  event: H3Event,
  filters: AppointmentFilters,
  catalog: {
    organizationId: string;
    branches: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
    employees: Array<{ id: string; fullName: string }>;
  },
): Promise<AppointmentsListResult> {
  const context = await requireAppointmentContextStrict(event);

  const { startIso, endIso } = getDateRange(filters.view, filters.anchorDate);

  let query = context.adminClient
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

  if (filters.scopeRole === "manager" && filters.managerBranchId) {
    query = query.eq("branch_id", filters.managerBranchId);
  }

  if (filters.scopeRole === "employee") {
    query = query.eq("employee_id", filters.currentProfileId);
  }

  if (filters.scopeRole === "client") {
    const { data: myClient, error: myClientError } = await context.adminClient
      .from("clients")
      .select("id")
      .eq("user_id", filters.currentProfileId)
      .maybeSingle<Pick<ClientRow, "id">>();

    if (myClientError) {
      throw createError({
        statusCode: 500,
        statusMessage: myClientError.message,
      });
    }

    query = query.eq("customer_id", myClient?.id ?? "00000000-0000-0000-0000-000000000000");
  }

  const { data: appointments, error: appointmentsError } = await query.returns<AppointmentRow[]>();

  if (appointmentsError) {
    throw createError({
      statusCode: 500,
      statusMessage: appointmentsError.message,
    });
  }

  const rows = appointments ?? [];
  const branchMap = new Map(catalog.branches.map((branch) => [branch.id, branch.name]));
  const serviceMap = new Map(catalog.services.map((service) => [service.id, service.name]));
  const employeeMap = new Map(catalog.employees.map((employee) => [employee.id, employee.fullName]));

  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter((value): value is string => Boolean(value))));
  const customerLookup = new Map<string, { id: string; fullName: string; phone: string | null }>();

  if (customerIds.length > 0) {
    const { data: customers, error: customersError } = await context.adminClient
      .from("clients")
      .select("id, first_name, last_name, phone")
      .in("id", customerIds)
      .returns<Array<Pick<ClientRow, "id" | "first_name" | "last_name" | "phone">>>();

    if (customersError) {
      throw createError({
        statusCode: 500,
        statusMessage: customersError.message,
      });
    }

    for (const customer of customers ?? []) {
      customerLookup.set(customer.id, {
        id: customer.id,
        fullName: [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Cliente",
        phone: customer.phone,
      });
    }
  }

  return {
    appointments: rows.map((row) => {
      const customer = row.customer_id ? customerLookup.get(row.customer_id) : null;

      return {
        id: row.id,
        organizationId: row.organization_id,
        branchId: row.branch_id,
        branchName: branchMap.get(row.branch_id) ?? "Sucursal",
        employeeId: row.employee_id,
        employeeName: employeeMap.get(row.employee_id) ?? "Equipo",
        serviceId: row.service_id,
        serviceName: serviceMap.get(row.service_id) ?? "Servicio",
        customerId: row.customer_id,
        customerName: customer?.fullName ?? row.customer_name ?? "Cliente temporal",
        customerPhone: customer?.phone ?? row.customer_phone,
        isWalkIn: !row.customer_id && Boolean(row.customer_name),
        startTime: row.start_time,
        endTime: row.end_time,
        status: readStatus(row.status),
        notes: row.notes,
        cancellationReason: row.cancellation_reason,
        transactionId: row.transaction_id,
      };
    }),
  };
}
