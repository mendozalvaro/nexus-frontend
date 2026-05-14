import { requireAppointmentContext } from "../../utils/appointments";

import type { Database } from "@/types/database.types";

import type { H3Event } from "h3";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 20;
const SLOT_DURATION_MINUTES = 30;

interface DailyStats {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

interface EmployeeRanking {
  id: string;
  fullName: string;
  appointmentCount: number;
}

export interface AppointmentDashboardResult {
  daily: {
    date: string;
    stats: DailyStats;
    occupancyPercent: number;
    estimatedRevenue: number;
    totalSlots: number;
    occupiedSlots: number;
  };
  topEmployees: EmployeeRanking[];
  weeklyNoShow: {
    total: number;
    noShowCount: number;
    noShowPercent: number;
    startDate: string;
    endDate: string;
  };
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

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export async function getAppointmentDashboard(
  event: H3Event,
  targetDate: string,
  scopeRole: "admin" | "manager" | "employee",
  currentProfileId: string,
  managerBranchId: string | null,
): Promise<AppointmentDashboardResult> {
  const context = await requireAppointmentContext(event);

  const target = parseDateInput(targetDate);
  const dayStart = startOfLocalDay(target);
  const dayEnd = endOfLocalDay(target);

  const weekStart = startOfLocalDay(addDays(target, -(target.getDay())));
  const weekEnd = endOfLocalDay(addDays(weekStart, 6));

  let baseQuery = context.adminClient
    .from("appointments")
    .select("*")
    .eq("organization_id", context.organizationId);

  if (scopeRole === "manager" && managerBranchId) {
    baseQuery = baseQuery.eq("branch_id", managerBranchId);
  }

  if (scopeRole === "employee") {
    baseQuery = baseQuery.eq("employee_id", currentProfileId);
  }

  const [{ data: dayAppointments }, { data: weekAppointments }, { data: services }, { data: employees }] = await Promise.all([
    baseQuery
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .returns<AppointmentRow[]>(),

    baseQuery
      .gte("start_time", weekStart.toISOString())
      .lte("start_time", weekEnd.toISOString())
      .returns<AppointmentRow[]>(),

    context.adminClient
      .from("services")
      .select("id, price")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .returns<Pick<ServiceRow, "id" | "price">[]>(),

    context.adminClient
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", context.organizationId)
      .in("role", ["admin", "manager", "employee"])
      .eq("is_active", true)
      .returns<Pick<ProfileRow, "id" | "full_name">[]>(),
  ]);

  const dayRows = dayAppointments ?? [];
  const weekRows = weekAppointments ?? [];
  const servicePriceMap = new Map((services ?? []).map((s) => [s.id, s.price]));
  const employeeNameMap = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  const readStatus = (value: AppointmentRow["status"]): AppointmentStatus => value ?? "pending";

  const buildDailyStats = (rows: AppointmentRow[]): DailyStats => {
    const stats: DailyStats = { total: 0, pending: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0, noShow: 0 };
    for (const row of rows) {
      stats.total++;
      const status = readStatus(row.status);
      if (status === "pending") stats.pending++;
      else if (status === "confirmed") stats.confirmed++;
      else if (status === "in_progress") stats.inProgress++;
      else if (status === "completed") stats.completed++;
      else if (status === "cancelled") stats.cancelled++;
      else if (status === "no_show") stats.noShow++;
    }
    return stats;
  };

  const totalSlotsPerDay = ((BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60) / SLOT_DURATION_MINUTES;

  const occupiedSlots = dayRows.filter((row) => {
    const status = readStatus(row.status);
    return !["cancelled", "no_show"].includes(status);
  }).length;

  const occupancyPercent = totalSlotsPerDay > 0
    ? Math.round((occupiedSlots / totalSlotsPerDay) * 100)
    : 0;

  const estimatedRevenue = dayRows.reduce((sum, row) => {
    const status = readStatus(row.status);
    if (["cancelled", "no_show"].includes(status)) return sum;
    const price = servicePriceMap.get(row.service_id) ?? 0;
    return sum + price;
  }, 0);

  const dailyStats = buildDailyStats(dayRows);

  const employeeCounts = new Map<string, number>();
  for (const row of dayRows) {
    const status = readStatus(row.status);
    if (["cancelled", "no_show"].includes(status)) continue;
    const current = employeeCounts.get(row.employee_id) ?? 0;
    employeeCounts.set(row.employee_id, current + 1);
  }

  const topEmployees: EmployeeRanking[] = Array.from(employeeCounts.entries())
    .map(([id, count]) => ({
      id,
      fullName: employeeNameMap.get(id) ?? "Sin nombre",
      appointmentCount: count,
    }))
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
    .slice(0, 5);

  const weeklyNoShowTotal = weekRows.length;
  const weeklyNoShowCount = weekRows.filter((row) => readStatus(row.status) === "no_show").length;
  const weeklyNoShowPercent = weeklyNoShowTotal > 0
    ? Math.round((weeklyNoShowCount / weeklyNoShowTotal) * 100)
    : 0;

  return {
    daily: {
      date: targetDate,
      stats: dailyStats,
      occupancyPercent,
      estimatedRevenue,
      totalSlots: totalSlotsPerDay,
      occupiedSlots,
    },
    topEmployees,
    weeklyNoShow: {
      total: weeklyNoShowTotal,
      noShowCount: weeklyNoShowCount,
      noShowPercent: weeklyNoShowPercent,
      startDate: formatDateISO(weekStart),
      endDate: formatDateISO(weekEnd),
    },
  };
}
