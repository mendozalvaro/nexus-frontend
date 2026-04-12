import type { Tables } from "@/types/database.types";

export type PaymentValidationRow = Tables<"payment_validations">;
export type OrganizationRow = Tables<"organizations">;

export interface ReceiptPreview {
  name: string;
  size: number;
  type: string;
  objectUrl: string | null;
  isPdf: boolean;
}

export type PaymentPageState =
  | "upload"
  | "pending"
  | "approved"
  | "rejected";

export interface PaymentValidationInfo {
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
}

export interface PaymentUploadPayload {
  organizationId: string;
  userId: string;
  amount: number;
  file: File;
  transactionRef?: string | null;
  confirmTransfer: boolean;
}

export interface PaymentStatusSummary {
  status: "missing" | "pending" | "approved" | "rejected";
  latestValidation: PaymentValidationRow | null;
}
