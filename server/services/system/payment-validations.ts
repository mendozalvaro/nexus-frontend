import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { Database, Json } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database, "public">>;
type StatsRpcRow =
  Database["public"]["Functions"]["admin_payment_validation_stats"]["Returns"][number];
type ListRpcRow =
  Database["public"]["Functions"]["admin_list_payment_validations"]["Returns"][number];
type DetailRpcRow =
  Database["public"]["Functions"]["admin_get_payment_validation_detail"]["Returns"][number];

export interface PaymentValidationStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  avgTime: string;
}

export interface PaymentValidationListResponse {
  rows: ListRpcRow[];
  total: number;
}

export interface PaymentValidationDetailResponse {
  row: (DetailRpcRow & {
    receipt_url: string | null;
    receipt_size_bytes: number | null;
  }) | null;
}

export interface PaymentValidationReviewResult {
  result: Json;
}

export interface PaymentValidationFilters {
  search?: string;
  status?: "all" | "pending" | "approved" | "rejected";
  dateFrom?: string;
  dateTo?: string;
  page: number;
  perPage: number;
}

const formatAvgTime = (value: number): string => {
  if (value <= 0) {
    return "0 min";
  }

  if (value < 60) {
    return `${Math.round(value)} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

const resolveReceiptSignedUrl = async (
  adminClient: AdminClient,
  storagePath: string,
): Promise<string | null> => {
  const { data, error } = await adminClient.storage
    .from("receipts")
    .createSignedUrl(storagePath, 60 * 30);

  if (error) {
    return null;
  }

  return data?.signedUrl ?? null;
};

const resolveReceiptSize = async (
  adminClient: AdminClient,
  storagePath: string,
): Promise<number | null> => {
  const segments = storagePath.split("/").filter(Boolean);
  const fileName = segments.pop();
  const folderPath = segments.join("/");

  if (!fileName) {
    return null;
  }

  const { data, error } = await adminClient.storage
    .from("receipts")
    .list(folderPath, { limit: 20, search: fileName });

  if (error || !Array.isArray(data)) {
    return null;
  }

  const fileEntry = data.find((entry) => entry.name === fileName);
  const size = (fileEntry?.metadata as { size?: number } | null | undefined)?.size;
  return typeof size === "number" ? size : null;
};

export async function getPaymentValidationStats(
  adminClient: AdminClient,
): Promise<PaymentValidationStats> {
  const { data, error } = await adminClient.rpc("admin_payment_validation_stats");

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  const row: StatsRpcRow | null = Array.isArray(data) ? (data[0] ?? null) : null;

  return {
    pending: row?.pending_count ?? 0,
    approvedToday: row?.approved_today ?? 0,
    rejectedToday: row?.rejected_today ?? 0,
    avgTime: formatAvgTime(row?.avg_review_minutes ?? 0),
  };
}

export async function listPaymentValidations(
  adminClient: AdminClient,
  filters: PaymentValidationFilters,
): Promise<PaymentValidationListResponse> {
  const { data, error } = await adminClient.rpc("admin_list_payment_validations", {
    p_search: filters.search || undefined,
    p_status: filters.status || undefined,
    p_date_from: filters.dateFrom || undefined,
    p_date_to: filters.dateTo || undefined,
    p_page: filters.page,
    p_page_size: filters.perPage,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  const rows = Array.isArray(data) ? (data as ListRpcRow[]) : [];
  const firstRow = rows[0] as (ListRpcRow & { total_count?: number }) | undefined;

  return {
    rows,
    total: Number(firstRow?.total_count ?? 0),
  };
}

export async function getPaymentValidationDetail(
  adminClient: AdminClient,
  validationId: string,
): Promise<PaymentValidationDetailResponse> {
  const { data, error } = await adminClient.rpc("admin_get_payment_validation_detail", {
    p_validation_id: validationId,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  const row: DetailRpcRow | null = Array.isArray(data) ? (data[0] ?? null) : null;
  if (!row) {
    return { row: null };
  }

  const [receiptUrl, receiptSizeBytes] = await Promise.all([
    resolveReceiptSignedUrl(adminClient, row.receipt_storage_path),
    resolveReceiptSize(adminClient, row.receipt_storage_path),
  ]);

  return {
    row: {
      ...row,
      receipt_url: receiptUrl,
      receipt_size_bytes: receiptSizeBytes,
    },
  };
}

export async function reviewPaymentValidation(
  adminClient: AdminClient,
  input: {
    validationId: string;
    decision: "approved" | "rejected";
    reason?: string | null;
  },
): Promise<PaymentValidationReviewResult> {
  const { data, error } = await adminClient.rpc("admin_review_payment_validation", {
    p_validation_id: input.validationId,
    p_decision: input.decision,
    p_reason: input.reason ?? undefined,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    result: data as Json,
  };
}
