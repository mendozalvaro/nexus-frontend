export interface PublicBookingBranch {
  id: string;
  name: string;
  address: string | null;
}

export interface PublicBookingService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  categoryName: string | null;
}

export interface PublicBookingEmployee {
  id: string;
  fullName: string;
  role: string;
  assignedBranchIds: string[];
  serviceIdsByBranch: Record<string, string[]>;
}

export interface PublicBookingCatalogResponse {
  organizationId: string;
  organizationName: string;
  timeZone: string;
  branches: PublicBookingBranch[];
  services: PublicBookingService[];
  employees: PublicBookingEmployee[];
}

export interface PublicBookingClientProfile {
  clientId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  orgStatus: "active" | "inactive" | "blocked";
}

export interface PublicBookingClientLinkPayload {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  billingData?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface PublicBookingSlot {
  label: string;
  value: string;
  available: boolean;
}

export interface PublicBookingAvailabilityResponse {
  date: string;
  slots: PublicBookingSlot[];
}

export interface PublicBookingCreatePayload {
  branchId: string;
  serviceId: string;
  employeeId: string;
  date: string;
  startTimeLocal: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface PublicBookingCreateResponse {
  success: boolean;
  appointmentId: string;
  status: "pending";
  customerName: string;
  serviceName: string;
  employeeName: string;
  startTime: string;
}
