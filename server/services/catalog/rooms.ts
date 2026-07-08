import { createError } from "h3";
import type { CatalogContext } from "../../utils/catalog";

export interface RoomItem {
  id: string;
  roomNumber: string;
  location: string | null;
  categoryId: string;
  categoryName: string;
  branchId: string;
  branchName: string;
  basePrice: number;
  status: string;
  notes: string | null;
  isActive: boolean;
}

export interface RoomFilters {
  branchId?: string;
  status?: string;
  availableOnly?: boolean;
  checkIn?: string;
  checkOut?: string;
}

export const getCatalogRooms = async (
  context: CatalogContext,
  filters: RoomFilters = {},
): Promise<RoomItem[]> => {
  let query = context.adminClient
    .from("rooms")
    .select("*, categories:category_id(name), branches:branch_id(name)")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true);

  if (context.allowedBranchIds.length > 0) {
    query = query.in("branch_id", context.allowedBranchIds);
  }

  const { data, error } = await query;

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  let rows = (data ?? []).map((row: Record<string, unknown>) => {
    const cat = row.categories as { name: string } | undefined;
    const br = row.branches as { name: string } | undefined;
    return {
      id: row.id as string,
      roomNumber: row.room_number as string,
      location: typeof row.location === "string" && row.location.trim().length > 0
        ? row.location.trim()
        : typeof row.floor === "number"
          ? `Piso ${row.floor}`
          : null,
      categoryId: row.category_id as string,
      categoryName: cat?.name ?? "",
      branchId: row.branch_id as string,
      branchName: br?.name ?? "",
      basePrice: Number(row.base_price ?? 0),
      status: row.status as string,
      notes: (row.notes as string) ?? null,
      isActive: (row.is_active as boolean) ?? true,
    };
  });

  if (filters.branchId) {
    rows = rows.filter((r) => r.branchId === filters.branchId);
  }

  if (filters.status) {
    rows = rows.filter((r) => r.status === filters.status);
  }

  if (filters.availableOnly && filters.checkIn && filters.checkOut) {
    const occupiedRoomIds = await getOccupiedRoomIds(context, filters.checkIn, filters.checkOut);
    rows = rows.filter((r) => !occupiedRoomIds.has(r.id) && r.status !== "maintenance");
  }

  return rows;
};

export interface CreateRoomPayload {
  roomNumber: string;
  location?: string | null;
  categoryId: string;
  branchId: string;
  basePrice: number;
  notes?: string;
}

export const createCatalogRoom = async (
  context: CatalogContext,
  payload: CreateRoomPayload,
): Promise<string> => {
  if (!context.allowedBranchIds.includes(payload.branchId)) {
    throw createError({ statusCode: 403, statusMessage: "No tienes acceso a esta sucursal." });
  }

  const { data, error } = await context.adminClient
    .from("rooms")
    .insert({
      organization_id: context.organizationId,
      branch_id: payload.branchId,
      category_id: payload.categoryId,
      room_number: payload.roomNumber.trim(),
      location: payload.location?.trim() || null,
      base_price: payload.basePrice,
      notes: payload.notes?.trim() || null,
      status: "available",
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo crear la habitacion.",
    });
  }

  return data.id;
};

export const updateCatalogRoom = async (
  context: CatalogContext,
  roomId: string,
  payload: Partial<CreateRoomPayload & { status: string }>,
): Promise<void> => {
  if (payload.branchId && !context.allowedBranchIds.includes(payload.branchId)) {
    throw createError({ statusCode: 403, statusMessage: "No tienes acceso a esta sucursal." });
  }

  const roomFields: Record<string, unknown> = {};
  if (payload.roomNumber !== undefined) roomFields.room_number = payload.roomNumber.trim();
  if (payload.location !== undefined) roomFields.location = payload.location?.trim() || null;
  if (payload.categoryId !== undefined) roomFields.category_id = payload.categoryId;
  if (payload.branchId !== undefined) roomFields.branch_id = payload.branchId;
  if (payload.basePrice !== undefined) roomFields.base_price = payload.basePrice;
  if (payload.status !== undefined) roomFields.status = payload.status;
  if (payload.notes !== undefined) roomFields.notes = payload.notes?.trim() || null;

  const { error } = await context.adminClient
    .from("rooms")
    .update(roomFields as never)
    .eq("id", roomId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
};

export const updateCatalogRoomStatus = async (
  context: CatalogContext,
  roomId: string,
  isActive: boolean,
): Promise<void> => {
  const { error } = await context.adminClient
    .from("rooms")
    .update({ is_active: isActive })
    .eq("id", roomId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
};

export const deleteCatalogRoom = async (
  context: CatalogContext,
  roomId: string,
): Promise<void> => {
  const { error } = await context.adminClient
    .from("rooms")
    .update({ is_active: false, status: "maintenance" })
    .eq("id", roomId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
};

async function getOccupiedRoomIds(
  context: CatalogContext,
  checkIn: string,
  checkOut: string,
): Promise<Set<string>> {
  const { data: reservations, error: resError } = await context.adminClient
    .from("reservations")
    .select("id, check_in, check_out, is_open_ended")
    .eq("organization_id", context.organizationId)
    .eq("status", "checked_in");

  if (resError || !reservations?.length) return new Set();

  const reservationIds = reservations
    .filter((reservation: { check_in: string; check_out: string; is_open_ended: boolean | null }) => {
      if (reservation.is_open_ended) {
        return reservation.check_in < checkOut;
      }
      return reservation.check_in < checkOut && reservation.check_out > checkIn;
    })
    .map((r: { id: string }) => r.id);

  if (reservationIds.length === 0) return new Set();

  const { data: roomLinks, error: roomError } = await context.adminClient
    .from("reservation_rooms")
    .select("room_id")
    .in("reservation_id", reservationIds);

  if (roomError) return new Set();
  return new Set((roomLinks ?? []).map((r: { room_id: string }) => r.room_id));
}
