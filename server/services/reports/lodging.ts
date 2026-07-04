import { createError } from "h3";

import type { Database } from "@/types/database.types";
import type { TenantContext } from "../../utils/tenant-context";

type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export interface LodgingSummaryReport {
  activeReservations: number;
  checkInsToday: number;
  checkOutsToday: number;
  revenueToday: number;
  monthlyRevenue: number;
}

export interface LodgingOccupancyReport {
  total: number;
  occupied: number;
  available: number;
  maintenance: number;
  cleaning: number;
  occupancyRate: number;
}

export interface LodgingRevenueReport {
  from: string;
  to: string;
  totalRevenue: number;
  dailyRevenue: Array<{ date: string; amount: number }>;
}

export interface LodgingDailyGuestRow {
  fullName: string;
  documentType: string;
  documentNumber: string;
  roomNumber: string;
  time: string;
  date: string;
  age: string;
  maritalStatus: string;
  nationality: string;
  origin: string;
}

export interface LodgingDailyGuestControlReport {
  reportDate: string;
  organizationName: string;
  organizationAddress: string;
  contactPhone: string;
  checkIns: LodgingDailyGuestRow[];
  staying: LodgingDailyGuestRow[];
  checkOuts: LodgingDailyGuestRow[];
}

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = ["checked_in", "checked_out"];

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const calculateAge = (birthDate: string | null): string => {
  if (!birthDate) {
    return "";
  }

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return "";
  }

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  const dayDiff = now.getDate() - birth.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
};

const toDisplayTime = (timestamp: string | null): string => {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const getReservationEventDate = (
  reservation: Record<string, unknown>,
  event: "check_in" | "check_out",
): string | null => {
  const actualField = event === "check_in" ? "actual_check_in_at" : "actual_check_out_at";
  const actualValue = reservation[actualField];
  if (typeof actualValue === "string" && actualValue.length >= 10) {
    return actualValue.slice(0, 10);
  }

  const plannedField = event === "check_in" ? "check_in" : "check_out";
  return typeof reservation[plannedField] === "string" ? reservation[plannedField] as string : null;
};

const getReservationEventTime = (
  reservation: Record<string, unknown>,
  event: "check_in" | "check_out" | "staying",
) => {
  const field = event === "check_out" ? "actual_check_out_at" : "actual_check_in_at";
  const actualValue = reservation[field];
  if (typeof actualValue === "string") {
    return actualValue;
  }

  return typeof reservation.created_at === "string" ? reservation.created_at : null;
};

const mapGuestRow = (
  reservation: Record<string, unknown>,
  roomNumber: string,
  guest: Record<string, unknown>,
  reportDate: string,
  event: "check_in" | "check_out" | "staying",
): LodgingDailyGuestRow => ({
  fullName: String(guest.full_name ?? ""),
  documentType: String(guest.document_type ?? ""),
  documentNumber: String(guest.document_number ?? ""),
  roomNumber,
  time: toDisplayTime(getReservationEventTime(reservation, event)),
  date: reportDate,
  age: calculateAge(typeof guest.birth_date === "string" ? guest.birth_date : null),
  maritalStatus: String(guest.marital_status ?? ""),
  nationality: String(guest.nationality ?? ""),
  origin: String(guest.address ?? ""),
});

const flattenGuests = (
  reservations: Array<Record<string, unknown>> | null | undefined,
  reportDate: string,
  event: "check_in" | "check_out" | "staying",
): LodgingDailyGuestRow[] => {
  return (reservations ?? []).flatMap((reservation) => {
    const roomLinks = (reservation.reservation_rooms as Array<Record<string, unknown>> | undefined) ?? [];

    return roomLinks.flatMap((roomLink) => {
      const room = (roomLink.rooms as Record<string, unknown> | undefined) ?? {};
      const guests = (roomLink.guests as Array<Record<string, unknown>> | undefined) ?? [];
      const roomNumber = String(room.room_number ?? "");

      return guests.map((guest) => mapGuestRow(reservation, roomNumber, guest, reportDate, event));
    });
  });
};

export const reservationAppearsInStaying = (
  reservation: Pick<ReservationRowLike, "status" | "check_in" | "check_out" | "actual_check_in_at" | "actual_check_out_at" | "is_open_ended">,
  reportDate: string,
) => {
  if (reservation.status !== "checked_in") {
    return false;
  }

  const startDate = reservation.actual_check_in_at?.slice(0, 10) ?? reservation.check_in;
  if (startDate >= reportDate) {
    return false;
  }

  if (reservation.is_open_ended) {
    return true;
  }

  const endDate = reservation.actual_check_out_at?.slice(0, 10) ?? reservation.check_out;
  return endDate > reportDate;
};

type ReservationRowLike = {
  status: string | null;
  check_in: string;
  check_out: string;
  actual_check_in_at: string | null;
  actual_check_out_at: string | null;
  is_open_ended: boolean | null;
};

export async function getLodgingSummaryReport(context: TenantContext): Promise<LodgingSummaryReport> {
  const today = todayIsoDate();

  const [{ count: activeCount }, { data: checkInsToday }, { data: checkOutsToday }, { data: revenueData }] =
    await Promise.all([
      context.adminClient
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", context.organizationId)
        .eq("status", "checked_in"),
      context.adminClient
        .from("reservations")
        .select("check_in, actual_check_in_at")
        .eq("organization_id", context.organizationId)
        .in("status", ACTIVE_RESERVATION_STATUSES),
      context.adminClient
        .from("reservations")
        .select("check_out, actual_check_out_at")
        .eq("organization_id", context.organizationId)
        .in("status", ACTIVE_RESERVATION_STATUSES),
      context.adminClient
        .from("reservation_payments")
        .select("amount")
        .eq("organization_id", context.organizationId)
        .gte("paid_at", `${today}T00:00:00`)
        .lte("paid_at", `${today}T23:59:59`),
    ]);

  const monthlyStart = new Date();
  monthlyStart.setDate(1);
  monthlyStart.setHours(0, 0, 0, 0);

  const { data: monthlyData } = await context.adminClient
    .from("reservation_payments")
    .select("amount")
    .eq("organization_id", context.organizationId)
    .gte("paid_at", monthlyStart.toISOString());

  const checkInsTodayCount = (checkInsToday ?? []).filter((reservation: Record<string, unknown>) =>
    getReservationEventDate(reservation, "check_in") === today).length;
  const checkOutsTodayCount = (checkOutsToday ?? []).filter((reservation: Record<string, unknown>) =>
    getReservationEventDate(reservation, "check_out") === today).length;

  return {
    activeReservations: activeCount ?? 0,
    checkInsToday: checkInsTodayCount,
    checkOutsToday: checkOutsTodayCount,
    revenueToday: (revenueData ?? []).reduce((sum: number, row: { amount: number }) => sum + Number(row.amount), 0),
    monthlyRevenue: (monthlyData ?? []).reduce((sum: number, row: { amount: number }) => sum + Number(row.amount), 0),
  };
}

export async function getLodgingOccupancyReport(context: TenantContext): Promise<LodgingOccupancyReport> {
  const { data: rooms } = await context.adminClient
    .from("rooms")
    .select("id, status")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true);

  const total = rooms?.length ?? 0;
  const occupied = rooms?.filter((room: { status: string }) => room.status === "occupied").length ?? 0;
  const maintenance = rooms?.filter((room: { status: string }) => room.status === "maintenance").length ?? 0;
  const cleaning = rooms?.filter((room: { status: string }) => room.status === "cleaning").length ?? 0;

  return {
    total,
    occupied,
    maintenance,
    cleaning,
    available: total - occupied - maintenance - cleaning,
    occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
  };
}

export async function getLodgingRevenueReport(
  context: TenantContext,
  from: string,
  to: string,
): Promise<LodgingRevenueReport> {
  const { data: payments } = await context.adminClient
    .from("reservation_payments")
    .select("amount, paid_at")
    .eq("organization_id", context.organizationId)
    .gte("paid_at", `${from}T00:00:00`)
    .lte("paid_at", `${to}T23:59:59`)
    .order("paid_at", { ascending: true });

  const dailyMap = new Map<string, number>();
  for (const payment of payments ?? []) {
    const day = String(payment.paid_at ?? "").slice(0, 10);
    if (!day) {
      continue;
    }
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(payment.amount));
  }

  return {
    from,
    to,
    totalRevenue: (payments ?? []).reduce((sum: number, payment: { amount: number }) => sum + Number(payment.amount), 0),
    dailyRevenue: Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount })),
  };
}

export async function getLodgingDailyGuestControlReport(
  context: TenantContext,
  reportDate: string,
): Promise<LodgingDailyGuestControlReport> {
  const [organizationResult, branchResult, reservationsResult] = await Promise.all([
    context.adminClient
      .from("organizations")
      .select("name, address")
      .eq("id", context.organizationId)
      .single(),
    context.adminClient
      .from("branches")
      .select("phone")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    context.adminClient
      .from("reservations")
      .select("id, created_at, status, check_in, check_out, actual_check_in_at, actual_check_out_at, is_open_ended, reservation_rooms(rooms:room_id(room_number), guests:reservation_guests(full_name, document_type, document_number, birth_date, nationality, address, marital_status))")
      .eq("organization_id", context.organizationId)
      .in("status", ACTIVE_RESERVATION_STATUSES)
  ]);

  if (organizationResult.error || !organizationResult.data) {
    throw createError({ statusCode: 500, statusMessage: organizationResult.error?.message ?? "No se pudo cargar la organizacion." });
  }

  const firstError =
    branchResult.error
    ?? reservationsResult.error;

  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message });
  }

  const reservations = (reservationsResult.data as Array<Record<string, unknown>> | null | undefined) ?? [];
  const checkIns = reservations.filter((reservation) => getReservationEventDate(reservation, "check_in") === reportDate);
  const checkOuts = reservations.filter((reservation) => getReservationEventDate(reservation, "check_out") === reportDate);
  const staying = reservations.filter((reservation) =>
    reservationAppearsInStaying(reservation as ReservationRowLike, reportDate));

  return {
    reportDate,
    organizationName: organizationResult.data.name,
    organizationAddress: organizationResult.data.address ?? "",
    contactPhone: branchResult.data?.phone ?? "",
    checkIns: flattenGuests(checkIns, reportDate, "check_in"),
    staying: flattenGuests(staying, reportDate, "staying"),
    checkOuts: flattenGuests(checkOuts, reportDate, "check_out"),
  };
}
