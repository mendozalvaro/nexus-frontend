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

export interface CreateReservationPayload {
  branchId: string;
  checkIn: string;
  checkOut: string;
  openEnded?: boolean;
  rooms: Array<{
    roomId: string;
    notes?: string;
    guests: Array<{
      fullName: string;
      documentType?: string;
      documentNumber?: string;
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

export interface ReservationStayActionPayload {
  action: "check_in" | "check_out" | "complete_stay" | "extend_stay";
  openEnded?: boolean;
  effectiveCheckOut?: string;
  notes?: string;
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

export const RESERVATION_STATUS_OPTIONS = [
  { label: "Todas", value: "" },
  { label: "En uso", value: "checked_in" },
  { label: "Salida registrada", value: "checked_out" },
  { label: "Cancelada", value: "cancelled" },
  { label: "No Show", value: "no_show" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pendiente legado",
  pending: "Pendiente legado",
  confirmed: "Reservado legado",
  checked_in: "En uso",
  checked_out: "Salida registrada",
  cancelled: "Cancelada",
  no_show: "No Show",
};

export const getReservationStatusMeta = (reservation: {
  status: string;
  isOpenEnded?: boolean;
  extendedFromCheckOut?: string | null;
}) => {
  if (reservation.status === "checked_in" && reservation.isOpenEnded) {
    return { label: "En uso indefinido", color: "warning" as const };
  }

  if (reservation.status === "checked_in" && reservation.extendedFromCheckOut) {
    return { label: "En uso extendida", color: "success" as const };
  }

  const colorMap = {
    confirmed: "primary",
    checked_in: "success",
    cancelled: "neutral",
    pending: "warning",
    pending_payment: "warning",
    no_show: "info",
    checked_out: "info",
  } as const;

  return {
    label: STATUS_LABELS[reservation.status] ?? reservation.status,
    color: colorMap[reservation.status as keyof typeof colorMap] ?? "neutral",
  };
};

export const useReservations = () => {
  const { resolveAccessToken } = useSessionAccess();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) throw createError({ statusCode: 401, statusMessage: "Sesion no disponible." });
    return { Authorization: `Bearer ${token}` };
  };

  const loadReservations = async (filters?: ReservationFilters) => {
    return await $fetch<{ rows: ReservationListItem[]; total: number }>("/api/reservations", {
      headers: await getAuthHeaders(),
      params: filters ?? {},
    });
  };

  const loadReservationDetail = async (id: string) => {
    return await $fetch<ReservationDetail>(`/api/reservations/${id}`, {
      headers: await getAuthHeaders(),
    });
  };

  const createReservation = async (payload: CreateReservationPayload) => {
    return await $fetch<{ success: boolean; reservationId: string }>("/api/reservations", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const loadRoomBoard = async (branchId?: string) => {
    return await $fetch<ReservationRoomBoardItem[]>("/api/reservations/room-board", {
      headers: await getAuthHeaders(),
      params: branchId ? { branchId } : {},
    });
  };

  const updateReservation = async (id: string, payload: { checkIn?: string; checkOut?: string; notes?: string }) => {
    return await $fetch<{ success: boolean; reservationId: string }>(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const checkIn = async (id: string) => {
    return await $fetch<{ success: boolean; reservationId: string }>(`/api/reservations/${id}/check-in`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  };

  const checkOut = async (id: string) => {
    return await $fetch<{ success: boolean; reservationId: string }>(`/api/reservations/${id}/check-out`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  };

  const stayAction = async (id: string, payload: ReservationStayActionPayload) => {
    return await $fetch<{ success: boolean; reservationId: string }>(`/api/reservations/${id}/stay-action`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const cancelReservation = async (id: string, reason: string) => {
    return await $fetch<{ success: boolean; reservationId: string }>(`/api/reservations/${id}/cancel`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { reason },
    });
  };

  const registerPayment = async (payload: {
    reservationId: string;
    amount: number;
    paymentMethod: string;
    paymentType: string;
    reference?: string;
    notes?: string;
  }) => {
    return await $fetch<{ success: boolean }>("/api/reservations/payments", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  return {
    loadReservations,
    loadRoomBoard,
    loadReservationDetail,
    createReservation,
    updateReservation,
    checkIn,
    checkOut,
    stayAction,
    cancelReservation,
    registerPayment,
  };
};
