import type { ReservationGuestSuggestion } from "@/composables/useReservations";

export type GuestSex = "male" | "female" | "other";

export type RoomGuest = {
  guestCustomerId: string | null;
  fullName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  sex: GuestSex;
  phone: string;
  email: string;
  nationality: string;
  maritalStatus: string;
  address: string;
  isMainGuest: boolean;
  lookupMessage: string | null;
  lookupState: "idle" | "loading" | "found" | "missing";
  suggestions: ReservationGuestSuggestion[];
  suggestionsOpen: boolean;
};

export type RoomGuestField =
  | "documentNumber"
  | "documentType"
  | "fullName"
  | "birthDate"
  | "sex"
  | "phone"
  | "email"
  | "nationality"
  | "maritalStatus"
  | "address";

export type SelectedRoom = {
  roomId: string;
  roomNumber: string;
  roomPrice: number;
  roomTypeName: string;
  guests: RoomGuest[];
};
