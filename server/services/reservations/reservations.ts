import { createError } from "h3";
import type { Database } from "@/types/database.types";
import type { ReservationContext } from "../../utils/reservations";
import { assertReservationBranchAccess } from "../../utils/reservations";

export interface ReservationListItem {
  id: string;
  roomNumbers: string;
  roomTypeNames: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  isOpenEnded: boolean;
  extendedFromCheckOut: string | null;
  extensionNotes: string | null;
  nights: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  source: string | null;
  createdAt: string;
}

export interface ReservationDetail {
  id: string;
  branchId: string;
  branchName: string;
  checkIn: string;
  checkOut: string;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  isOpenEnded: boolean;
  extendedFromCheckOut: string | null;
  extensionNotes: string | null;
  nights: number;
  status: string;
  totalAmount: number;
  paidAmount: number;
  source: string | null;
  notes: string | null;
  createdAt: string;
  rooms: ReservationRoomDetail[];
  payments: PaymentDetail[];
}

export interface ReservationRoomDetail {
  id: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  roomPrice: number;
  subtotal: number;
  notes: string | null;
  guests: GuestDetail[];
}

export interface GuestDetail {
  id: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  sex: string | null;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  address: string | null;
  maritalStatus: string | null;
  isMainGuest: boolean;
}

export interface PaymentDetail {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentType: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
}

export interface ReservationFilters {
  branchId?: string;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  perPage?: number;
}

export interface CreateReservationInput {
  branchId: string;
  checkIn: string;
  checkOut: string;
  openEnded?: boolean;
  rooms: Array<{
    roomId: string;
    notes?: string;
    guests: Array<{
      fullName: string;
      documentType: string;
      documentNumber: string;
      birthDate: string;
      sex: "male" | "female" | "other";
      phone?: string;
      email?: string;
      nationality?: string;
      address?: string;
      maritalStatus?: string;
      isMainGuest?: boolean;
    }>;
  }>;
  notes?: string;
  payment?: {
    amount: number;
    paymentMethod: string;
    paymentType: string;
    reference?: string;
    notes?: string;
  };
}

export interface UpdateReservationInput {
  checkIn?: string;
  checkOut?: string;
  notes?: string;
}

export interface ReservationStayActionInput {
  action: "check_in" | "check_out" | "complete_stay" | "extend_stay";
  openEnded?: boolean;
  effectiveCheckOut?: string;
  notes?: string;
}

export interface ReservationRoomBoardItem {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  branchId: string;
  branchName: string;
  status: "available" | "occupied";
  reservationId: string | null;
  reservationStatus: string | null;
  guestName: string | null;
  checkOut: string | null;
  isOpenEnded: boolean;
  balance: number;
}

type ReservationRow = Database["public"]["Tables"]["reservations"]["Row"];

const FINAL_RESERVATION_STATUSES = ["checked_out", "cancelled", "no_show"];
const LODGING_VISIBLE_STATUSES: Database["public"]["Enums"]["reservation_status"][] = ["checked_in", "checked_out", "cancelled", "no_show"];

const calculateNights = (checkIn: string, checkOut: string) =>
  Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));

export const resolveReservationStatusAfterPayment = (
  currentStatus: string,
  totalAmount: number,
  paidAmount: number,
) => {
  if (["checked_in", "checked_out", "cancelled", "no_show"].includes(currentStatus)) {
    return currentStatus;
  }

  return paidAmount >= totalAmount ? "confirmed" : "pending_payment";
};

export const reservationRangesOverlap = (
  reservation: Pick<ReservationRow, "check_in" | "check_out" | "is_open_ended">,
  requestedCheckIn: string,
  requestedCheckOut: string,
) => {
  if (reservation.is_open_ended) {
    return reservation.check_in < requestedCheckOut;
  }

  return reservation.check_in < requestedCheckOut && reservation.check_out > requestedCheckIn;
};

const updateRoomStatuses = async (
  context: ReservationContext,
  roomIds: string[],
  status: Database["public"]["Enums"]["room_status"],
) => {
  if (roomIds.length === 0) return;

  const { error } = await context.adminClient
    .from("rooms")
    .update({ status })
    .in("id", roomIds)
    .eq("organization_id", context.organizationId);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
};

const getReservationRoomIds = async (context: ReservationContext, reservationId: string): Promise<string[]> => {
  const { data, error } = await context.adminClient
    .from("reservation_rooms")
    .select("room_id")
    .eq("reservation_id", reservationId);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return (data ?? []).map((room) => room.room_id);
};

const assertRoomsAvailableForRange = async (
  context: ReservationContext,
  roomIds: string[],
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string,
) => {
  if (roomIds.length === 0) return;

  const { data: reservations, error: reservationsError } = await context.adminClient
    .from("reservations")
    .select("id, check_in, check_out, is_open_ended, status")
    .eq("organization_id", context.organizationId)
    .eq("status", "checked_in");

  if (reservationsError) {
    throw createError({ statusCode: 500, statusMessage: reservationsError.message });
  }

  const overlappingReservationIds = (reservations ?? [])
    .filter((reservation) => reservation.id !== excludeReservationId)
    .filter((reservation) => reservationRangesOverlap(reservation, checkIn, checkOut))
    .map((reservation) => reservation.id);

  if (overlappingReservationIds.length === 0) return;

  const { data: overlappingRooms, error: overlappingRoomsError } = await context.adminClient
    .from("reservation_rooms")
    .select("room_id")
    .in("reservation_id", overlappingReservationIds)
    .in("room_id", roomIds);

  if (overlappingRoomsError) {
    throw createError({ statusCode: 500, statusMessage: overlappingRoomsError.message });
  }

  if ((overlappingRooms ?? []).length > 0) {
    throw createError({ statusCode: 409, statusMessage: "Una o mas habitaciones ya estan reservadas en ese rango." });
  }
};

const recalculateReservationTotals = async (
  context: ReservationContext,
  reservationId: string,
  nights: number,
) => {
  const { data: roomLinks, error } = await context.adminClient
    .from("reservation_rooms")
    .select("id, room_price")
    .eq("reservation_id", reservationId);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  let totalAmount = 0;

  for (const roomLink of roomLinks ?? []) {
    const subtotal = Number(roomLink.room_price ?? 0) * nights;
    totalAmount += subtotal;
    const { error: updateError } = await context.adminClient
      .from("reservation_rooms")
      .update({ subtotal })
      .eq("id", roomLink.id);

    if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  const { error: reservationError } = await context.adminClient
    .from("reservations")
    .update({ total_amount: totalAmount })
    .eq("id", reservationId)
    .eq("organization_id", context.organizationId);

  if (reservationError) throw createError({ statusCode: 500, statusMessage: reservationError.message });
};

const getReservationForMutation = async (context: ReservationContext, reservationId: string) => {
  const { data: reservation, error } = await context.adminClient
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .eq("organization_id", context.organizationId)
    .single();

  if (error || !reservation) {
    throw createError({ statusCode: 404, statusMessage: "Reserva no encontrada." });
  }

  assertReservationBranchAccess(context, reservation.branch_id);

  const roomIds = await getReservationRoomIds(context, reservationId);
  return { reservation, roomIds };
};

export async function getReservationsList(
  context: ReservationContext,
  filters: ReservationFilters = {},
): Promise<{ rows: ReservationListItem[]; total: number }> {
  let baseQuery = context.adminClient
    .from("reservations")
    .select("*, reservation_rooms(reservation_id, room_id, rooms:room_id(room_number, categories:category_id(name)), guests:reservation_guests(full_name, is_main_guest))",
      { count: "exact" },
    )
    .eq("organization_id", context.organizationId)
    .in("branch_id", context.allowedBranchIds)
    .in("status", LODGING_VISIBLE_STATUSES)
    .order("created_at", { ascending: false });

  if (filters.branchId) baseQuery = baseQuery.eq("branch_id", filters.branchId);
  if (filters.status) {
    baseQuery = baseQuery.eq("status", filters.status as Database["public"]["Enums"]["reservation_status"]);
  }
  if (filters.fromDate) baseQuery = baseQuery.gte("check_in", filters.fromDate);
  if (filters.toDate) baseQuery = baseQuery.lte("check_out", filters.toDate);
  if (filters.search?.trim()) {
    const searchValue = filters.search.trim();
    baseQuery = baseQuery.or(`id.ilike.%${searchValue}%,notes.ilike.%${searchValue}%`);
  }

  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 20;
  const from = (page - 1) * perPage;
  baseQuery = baseQuery.range(from, from + perPage - 1);

  const { data, error, count } = await baseQuery;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const rows: ReservationListItem[] = (data ?? []).map((r: Record<string, unknown>) => {
    const rr = (r.reservation_rooms as Array<Record<string, unknown>>) ?? [];
    const roomLinks = rr.map((link: Record<string, unknown>) => link.rooms as Record<string, unknown> | undefined);
    const roomNumbers = roomLinks.map((room) => room?.room_number as string ?? "").filter(Boolean).join(", ");
    const roomTypes = roomLinks.map((room) => {
      const category = room?.categories as Record<string, unknown> | undefined;
      return category?.name as string ?? "";
    }).filter(Boolean).join(", ");
    const firstRoom = rr[0] as Record<string, unknown> | undefined;
    const firstGuests = firstRoom?.guests as Array<Record<string, unknown>> | undefined;
    const mainGuest = firstGuests?.find((guest) => Boolean(guest.is_main_guest));
    const fallbackGuest = firstGuests?.[0];
    const guestName = (mainGuest?.full_name as string) ?? (fallbackGuest?.full_name as string) ?? "—";

    return {
      id: r.id as string,
      roomNumbers,
      roomTypeNames: [...new Set(roomTypes.split(", "))].join(", "),
      guestName,
      checkIn: r.check_in as string,
      checkOut: r.check_out as string,
      actualCheckInAt: (r.actual_check_in_at as string) ?? null,
      actualCheckOutAt: (r.actual_check_out_at as string) ?? null,
      isOpenEnded: Boolean(r.is_open_ended),
      extendedFromCheckOut: (r.extended_from_check_out as string) ?? null,
      extensionNotes: (r.extension_notes as string) ?? null,
      nights: (r.nights as number) ?? 0,
      totalAmount: Number(r.total_amount ?? 0),
      paidAmount: Number(r.paid_amount ?? 0),
      balance: Number(r.total_amount ?? 0) - Number(r.paid_amount ?? 0),
      status: r.status as string,
      source: (r.source as string) ?? null,
      createdAt: (r.created_at as string) ?? "",
    };
  });

  return { rows, total: count ?? rows.length };
}

export async function getReservationDetail(
  context: ReservationContext,
  reservationId: string,
): Promise<ReservationDetail> {
  const { data: reservation, error: resError } = await context.adminClient
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .eq("organization_id", context.organizationId)
    .single();

  if (resError || !reservation) {
    throw createError({ statusCode: 404, statusMessage: "Reserva no encontrada." });
  }

  const r = reservation as Record<string, unknown>;
  const { data: branch } = await context.adminClient
    .from("branches")
    .select("name")
    .eq("id", r.branch_id as string)
    .maybeSingle<{ name: string | null }>();

  const { data: roomLinks, error: roomLinksError } = await context.adminClient
    .from("reservation_rooms")
    .select("*, rooms:room_id(room_number, category_id, categories:category_id(name))")
    .eq("reservation_id", reservationId);

  if (roomLinksError) throw createError({ statusCode: 500, statusMessage: roomLinksError.message });

  const rooms: ReservationRoomDetail[] = await Promise.all(
    (roomLinks ?? []).map(async (roomLink: Record<string, unknown>) => {
      const roomInfo = roomLink.rooms as { room_number: string; categories: { name: string } } | undefined;
      const { data: guests } = await context.adminClient
        .from("reservation_guests")
        .select("*")
        .eq("reservation_room_id", roomLink.id as string);

      return {
        id: roomLink.id as string,
        roomId: roomLink.room_id as string,
        roomNumber: roomInfo?.room_number ?? "",
        roomTypeName: roomInfo?.categories?.name ?? "",
        roomPrice: Number(roomLink.room_price ?? 0),
        subtotal: Number(roomLink.subtotal ?? 0),
        notes: (roomLink.notes as string) ?? null,
        guests: (guests ?? []).map((guest: Record<string, unknown>) => ({
          id: guest.id as string,
          fullName: guest.full_name as string,
          documentType: (guest.document_type as string) ?? null,
          documentNumber: (guest.document_number as string) ?? null,
          birthDate: (guest.birth_date as string) ?? null,
          sex: (guest.sex as string) ?? null,
          phone: (guest.phone as string) ?? null,
          email: (guest.email as string) ?? null,
          nationality: (guest.nationality as string) ?? null,
          address: (guest.address as string) ?? null,
          maritalStatus: (guest.marital_status as string) ?? null,
          isMainGuest: (guest.is_main_guest as boolean) ?? false,
        })),
      };
    }),
  );

  const { data: payments } = await context.adminClient
    .from("reservation_payments")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("paid_at", { ascending: false });

  return {
    id: r.id as string,
    branchId: r.branch_id as string,
    branchName: branch?.name ?? "",
    checkIn: r.check_in as string,
    checkOut: r.check_out as string,
    actualCheckInAt: (r.actual_check_in_at as string) ?? null,
    actualCheckOutAt: (r.actual_check_out_at as string) ?? null,
    isOpenEnded: Boolean(r.is_open_ended),
    extendedFromCheckOut: (r.extended_from_check_out as string) ?? null,
    extensionNotes: (r.extension_notes as string) ?? null,
    nights: (r.nights as number) ?? 0,
    status: (r.status as string) ?? "",
    totalAmount: Number(r.total_amount ?? 0),
    paidAmount: Number(r.paid_amount ?? 0),
    source: (r.source as string) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: (r.created_at as string) ?? "",
    rooms,
    payments: (payments ?? []).map((payment: Record<string, unknown>) => ({
      id: payment.id as string,
      amount: Number(payment.amount),
      paymentMethod: payment.payment_method as string,
      paymentType: payment.payment_type as string,
      reference: (payment.reference as string) ?? null,
      notes: (payment.notes as string) ?? null,
      paidAt: (payment.paid_at as string) ?? "",
    })),
  };
}

export async function createReservation(
  context: ReservationContext,
  userId: string,
  input: CreateReservationInput,
): Promise<string> {
  assertReservationBranchAccess(context, input.branchId);

  const nights = calculateNights(input.checkIn, input.checkOut);
  if (nights <= 0) {
    throw createError({ statusCode: 400, statusMessage: "La reserva debe tener al menos una noche." });
  }

  const requestedRoomIds = input.rooms.map((room) => room.roomId);
  const { data: rooms, error: roomsError } = await context.adminClient
    .from("rooms")
    .select("id, branch_id, is_active, status, base_price")
    .eq("organization_id", context.organizationId)
    .in("id", requestedRoomIds);

  if (roomsError) throw createError({ statusCode: 500, statusMessage: roomsError.message });

  const roomMap = new Map((rooms ?? []).map((room) => [room.id, room]));
  for (const roomId of requestedRoomIds) {
    const room = roomMap.get(roomId);
    if (!room) {
      throw createError({ statusCode: 404, statusMessage: "Una de las habitaciones seleccionadas no existe." });
    }
    if (room.branch_id !== input.branchId) {
      throw createError({ statusCode: 409, statusMessage: "La habitacion no pertenece a la sucursal de la reserva." });
    }
    if (!room.is_active || room.status === "maintenance") {
      throw createError({ statusCode: 409, statusMessage: "Una de las habitaciones no esta disponible." });
    }
  }

  await assertRoomsAvailableForRange(context, requestedRoomIds, input.checkIn, input.checkOut);

  const totalAmount = input.rooms.reduce((sum, roomInput) => {
    const room = roomMap.get(roomInput.roomId);
    return sum + Number(room?.base_price ?? 0) * nights;
  }, 0);
  const initialPaymentAmount = Number(input.payment?.amount ?? 0);

  if (initialPaymentAmount > totalAmount) {
    throw createError({ statusCode: 409, statusMessage: "El pago inicial excede el monto total de la reserva." });
  }

  const { data: reservation, error: reservationError } = await context.adminClient
    .from("reservations")
    .insert({
      organization_id: context.organizationId,
      branch_id: input.branchId,
      check_in: input.checkIn,
      check_out: input.checkOut,
      status: "checked_in",
      total_amount: totalAmount,
      paid_amount: initialPaymentAmount,
      source: "staff",
      notes: input.notes?.trim() || null,
      created_by: userId,
      actual_check_in_at: new Date().toISOString(),
      is_open_ended: input.openEnded === true,
    })
    .select("id")
    .single<{ id: string }>();

  if (reservationError || !reservation) {
    throw createError({ statusCode: 500, statusMessage: reservationError?.message ?? "No se pudo crear la reserva." });
  }

  for (const roomInput of input.rooms) {
    const room = roomMap.get(roomInput.roomId);
    const roomPrice = Number(room?.base_price ?? 0);
    const subtotal = roomPrice * nights;

    const { data: roomLink, error: roomLinkError } = await context.adminClient
      .from("reservation_rooms")
      .insert({
        reservation_id: reservation.id,
        room_id: roomInput.roomId,
        room_price: roomPrice,
        subtotal,
        notes: roomInput.notes?.trim() || null,
      })
      .select("id")
      .single<{ id: string }>();

    if (roomLinkError || !roomLink) {
      throw createError({ statusCode: 500, statusMessage: roomLinkError?.message ?? "No se pudo asignar la habitacion." });
    }

    for (const guest of roomInput.guests) {
      const { error: guestError } = await context.adminClient
        .from("reservation_guests")
        .insert({
          reservation_room_id: roomLink.id,
          full_name: guest.fullName.trim(),
          document_type: guest.documentType.trim(),
          document_number: guest.documentNumber.trim(),
          birth_date: guest.birthDate,
          sex: guest.sex,
          phone: guest.phone?.trim() || null,
          email: guest.email?.trim() || null,
          nationality: guest.nationality?.trim() || null,
          address: guest.address?.trim() || null,
          marital_status: guest.maritalStatus?.trim() || null,
          is_main_guest: guest.isMainGuest === true,
        });

      if (guestError) {
        throw createError({ statusCode: 500, statusMessage: guestError.message });
      }
    }
  }

  if (initialPaymentAmount > 0 && input.payment) {
    const { error: paymentError } = await context.adminClient
      .from("reservation_payments")
      .insert({
        organization_id: context.organizationId,
        reservation_id: reservation.id,
        amount: initialPaymentAmount,
        payment_method: input.payment.paymentMethod,
        payment_type: input.payment.paymentType,
        reference: input.payment.reference?.trim() || null,
        notes: input.payment.notes?.trim() || null,
        created_by: userId,
      });

    if (paymentError) {
      throw createError({ statusCode: 500, statusMessage: paymentError.message });
    }
  }

  await updateRoomStatuses(context, requestedRoomIds, "occupied");

  return reservation.id;
}

export async function updateReservation(
  context: ReservationContext,
  reservationId: string,
  input: UpdateReservationInput,
): Promise<void> {
  const { reservation, roomIds } = await getReservationForMutation(context, reservationId);

  if (FINAL_RESERVATION_STATUSES.includes(reservation.status ?? "")) {
    throw createError({ statusCode: 409, statusMessage: "No se puede modificar una reserva finalizada o cancelada." });
  }

  const nextCheckIn = input.checkIn ?? reservation.check_in;
  const nextCheckOut = input.checkOut ?? reservation.check_out;

  if (nextCheckOut <= nextCheckIn) {
    throw createError({ statusCode: 400, statusMessage: "La fecha de salida debe ser posterior a la de entrada." });
  }

  await assertRoomsAvailableForRange(context, roomIds, nextCheckIn, nextCheckOut, reservationId);

  const updates: Database["public"]["Tables"]["reservations"]["Update"] = {};
  if (input.checkIn) updates.check_in = input.checkIn;
  if (input.checkOut) updates.check_out = input.checkOut;
  if (input.notes !== undefined) updates.notes = input.notes.trim() || null;

  if (Object.keys(updates).length === 0) return;

  const { error } = await context.adminClient
    .from("reservations")
    .update(updates)
    .eq("id", reservationId)
    .eq("organization_id", context.organizationId);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  if (input.checkIn || input.checkOut) {
    await recalculateReservationTotals(context, reservationId, calculateNights(nextCheckIn, nextCheckOut));
  }
}

export async function applyReservationStayAction(
  context: ReservationContext,
  reservationId: string,
  input: ReservationStayActionInput,
): Promise<void> {
  const { reservation, roomIds } = await getReservationForMutation(context, reservationId);
  const now = new Date().toISOString();
  const notes = input.notes?.trim() || null;

  if (input.action === "check_in") {
    if (reservation.status !== "confirmed") {
      throw createError({ statusCode: 409, statusMessage: "Solo se puede hacer check-in a reservas confirmadas." });
    }

    const { error } = await context.adminClient
      .from("reservations")
      .update({
        status: "checked_in",
        actual_check_in_at: reservation.actual_check_in_at ?? now,
        is_open_ended: input.openEnded === true,
        extension_notes: notes ?? reservation.extension_notes,
      })
      .eq("id", reservationId)
      .eq("organization_id", context.organizationId);

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    await updateRoomStatuses(context, roomIds, "occupied");
    return;
  }

  if (input.action === "check_out") {
    if (reservation.status !== "checked_in") {
      throw createError({ statusCode: 409, statusMessage: "Solo se puede hacer check-out a reservas en check-in." });
    }

    const { error } = await context.adminClient
      .from("reservations")
      .update({
        status: "checked_out",
        actual_check_out_at: now,
        is_open_ended: false,
        extension_notes: notes ?? reservation.extension_notes,
      })
      .eq("id", reservationId)
      .eq("organization_id", context.organizationId);

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    await updateRoomStatuses(context, roomIds, "available");
    return;
  }

  if (input.action === "complete_stay") {
    if (reservation.status !== "confirmed") {
      throw createError({ statusCode: 409, statusMessage: "Solo se puede cerrar una estadía express desde una reserva confirmada." });
    }

    const { error } = await context.adminClient
      .from("reservations")
      .update({
        status: "checked_out",
        actual_check_in_at: reservation.actual_check_in_at ?? now,
        actual_check_out_at: now,
        is_open_ended: false,
        extension_notes: notes ?? reservation.extension_notes,
      })
      .eq("id", reservationId)
      .eq("organization_id", context.organizationId);

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    await updateRoomStatuses(context, roomIds, "available");
    return;
  }

  if (input.action === "extend_stay") {
    if (reservation.status !== "checked_in") {
      throw createError({ statusCode: 409, statusMessage: "Solo se puede alargar una reserva en check-in." });
    }

    const updates: Database["public"]["Tables"]["reservations"]["Update"] = {
      extension_notes: notes ?? reservation.extension_notes,
    };

    const shouldStoreOriginalCheckOut = !reservation.extended_from_check_out && (input.openEnded === true || input.effectiveCheckOut && input.effectiveCheckOut !== reservation.check_out);
    if (shouldStoreOriginalCheckOut) {
      updates.extended_from_check_out = reservation.check_out;
    }

    if (input.openEnded === true) {
      updates.is_open_ended = true;
    } else {
      const nextCheckOut = input.effectiveCheckOut;
      if (!nextCheckOut || nextCheckOut <= reservation.check_in) {
        throw createError({ statusCode: 400, statusMessage: "La nueva fecha de salida es invalida." });
      }

      await assertRoomsAvailableForRange(context, roomIds, reservation.check_in, nextCheckOut, reservationId);
      updates.check_out = nextCheckOut;
      updates.is_open_ended = false;
      await recalculateReservationTotals(context, reservationId, calculateNights(reservation.check_in, nextCheckOut));
    }

    const { error } = await context.adminClient
      .from("reservations")
      .update(updates)
      .eq("id", reservationId)
      .eq("organization_id", context.organizationId);

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    await updateRoomStatuses(context, roomIds, "occupied");
    return;
  }
}

export async function checkInReservation(context: ReservationContext, reservationId: string): Promise<void> {
  await applyReservationStayAction(context, reservationId, { action: "check_in" });
}

export async function checkOutReservation(context: ReservationContext, reservationId: string): Promise<void> {
  await applyReservationStayAction(context, reservationId, { action: "check_out" });
}

export async function cancelReservation(
  context: ReservationContext,
  userId: string,
  reservationId: string,
  reason: string,
): Promise<void> {
  const { data: reservation, error: reservationError } = await context.adminClient
    .from("reservations")
    .select("status")
    .eq("id", reservationId)
    .eq("organization_id", context.organizationId)
    .single<{ status: string }>();

  if (reservationError || !reservation) throw createError({ statusCode: 404, statusMessage: "Reserva no encontrada." });
  if (FINAL_RESERVATION_STATUSES.includes(reservation.status)) {
    throw createError({ statusCode: 409, statusMessage: "La reserva ya esta finalizada o cancelada." });
  }

  const roomIds = await getReservationRoomIds(context, reservationId);

  const { error } = await context.adminClient
    .from("reservations")
    .update({
      status: "cancelled",
      cancellation_reason: reason.trim(),
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      is_open_ended: false,
    })
    .eq("id", reservationId)
    .eq("organization_id", context.organizationId);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  await updateRoomStatuses(context, roomIds, "available");
}

export async function registerPayment(
  context: ReservationContext,
  userId: string,
  input: {
    reservationId: string;
    amount: number;
    paymentMethod: string;
    paymentType: string;
    reference?: string;
    notes?: string;
  },
): Promise<void> {
  const { data: reservation, error: reservationError } = await context.adminClient
    .from("reservations")
    .select("total_amount, paid_amount, branch_id, status")
    .eq("id", input.reservationId)
    .eq("organization_id", context.organizationId)
    .single<{ total_amount: number; paid_amount: number; branch_id: string; status: string }>();

  if (reservationError || !reservation) throw createError({ statusCode: 404, statusMessage: "Reserva no encontrada." });
  assertReservationBranchAccess(context, reservation.branch_id);

  const newPaid = Number(reservation.paid_amount) + input.amount;
  if (newPaid > Number(reservation.total_amount)) {
    throw createError({ statusCode: 409, statusMessage: "El pago excede el monto total de la reserva." });
  }

  const { error: paymentError } = await context.adminClient
    .from("reservation_payments")
    .insert({
      organization_id: context.organizationId,
      reservation_id: input.reservationId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      payment_type: input.paymentType,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId,
    });

  if (paymentError) throw createError({ statusCode: 500, statusMessage: paymentError.message });

  const { error: updateError } = await context.adminClient
    .from("reservations")
    .update({
      paid_amount: newPaid,
      status: resolveReservationStatusAfterPayment(
        reservation.status,
        Number(reservation.total_amount),
        newPaid,
      ) as Database["public"]["Enums"]["reservation_status"],
    })
    .eq("id", input.reservationId)
    .eq("organization_id", context.organizationId);

  if (updateError) throw createError({ statusCode: 500, statusMessage: updateError.message });
}

export async function getReservationRoomBoard(
  context: ReservationContext,
  branchId?: string,
): Promise<ReservationRoomBoardItem[]> {
  let roomsQuery = context.adminClient
    .from("rooms")
    .select("id, room_number, branch_id, branches:branch_id(name), categories:category_id(name), status")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true);

  if (context.allowedBranchIds.length > 0) {
    roomsQuery = roomsQuery.in("branch_id", context.allowedBranchIds);
  }

  if (branchId) {
    roomsQuery = roomsQuery.eq("branch_id", branchId);
  }

  const { data: rooms, error: roomsError } = await roomsQuery;
  if (roomsError) throw createError({ statusCode: 500, statusMessage: roomsError.message });

  const activeRooms = (rooms ?? []).filter((room) => room.status !== "maintenance");
  const roomIds = activeRooms.map((room) => room.id);

  if (roomIds.length === 0) {
    return [];
  }

  const { data: roomLinks, error: roomLinksError } = await context.adminClient
    .from("reservation_rooms")
    .select(`
      room_id,
      reservations:reservation_id(id, branch_id, status, check_out, is_open_ended, total_amount, paid_amount),
      guests:reservation_guests(full_name, is_main_guest)
    `)
    .in("room_id", roomIds);

  if (roomLinksError) throw createError({ statusCode: 500, statusMessage: roomLinksError.message });

  const occupiedByRoomId = new Map<string, ReservationRoomBoardItem>();

  for (const link of roomLinks ?? []) {
    const reservation = Array.isArray(link.reservations) ? link.reservations[0] : link.reservations;
    if (!reservation || reservation.status !== "checked_in") {
      continue;
    }

    const guests = Array.isArray(link.guests) ? link.guests : [];
    const mainGuest = guests.find((guest) => guest.is_main_guest) ?? guests[0] ?? null;

    occupiedByRoomId.set(link.room_id, {
      roomId: link.room_id,
      roomNumber: "",
      roomTypeName: "",
      branchId: reservation.branch_id,
      branchName: "",
      status: "occupied",
      reservationId: reservation.id,
      reservationStatus: reservation.status,
      guestName: mainGuest?.full_name ?? null,
      checkOut: reservation.check_out,
      isOpenEnded: Boolean(reservation.is_open_ended),
      balance: Number(reservation.total_amount ?? 0) - Number(reservation.paid_amount ?? 0),
    });
  }

  return activeRooms
    .map((room) => {
      const branch = room.branches as { name?: string } | null;
      const category = room.categories as { name?: string } | null;
      const occupied = occupiedByRoomId.get(room.id);

      return {
        roomId: room.id,
        roomNumber: room.room_number,
        roomTypeName: category?.name ?? "",
        branchId: room.branch_id,
        branchName: branch?.name ?? "",
        status: occupied?.status ?? "available",
        reservationId: occupied?.reservationId ?? null,
        reservationStatus: occupied?.reservationStatus ?? null,
        guestName: occupied?.guestName ?? null,
        checkOut: occupied?.checkOut ?? null,
        isOpenEnded: occupied?.isOpenEnded ?? false,
        balance: occupied?.balance ?? 0,
      } satisfies ReservationRoomBoardItem;
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "occupied" ? -1 : 1;
      }
      return left.roomNumber.localeCompare(right.roomNumber, undefined, { numeric: true });
    });
}
