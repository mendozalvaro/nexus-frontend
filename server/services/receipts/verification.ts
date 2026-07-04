import { createHmac, timingSafeEqual } from "node:crypto";

import type { Database } from "@/types/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type ReceiptFormat = "thermal" | "half_letter";

interface ReceiptTokenPayload {
  receiptId: string;
  issuedAt: number;
  version: 1;
}

const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180; // 180 dias
const TOKEN_VERSION = 1 as const;

const getSecret = () => {
  const config = useRuntimeConfig();
  const rawSecret = config.receiptVerificationSecret ?? config.supabaseServiceRoleKey ?? "";
  const secret = String(rawSecret).trim();
  if (!secret) {
    throw new Error("Falta NUXT_RECEIPT_VERIFICATION_SECRET (o fallback service role key) para verificación de recibos.");
  }
  return secret;
};

const toBase64Url = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const fromBase64Url = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const signValue = (payloadEncoded: string, secret: string) => {
  return createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
};

export const buildReceiptVerificationToken = (receiptId: string, issuedAt = Date.now()): string => {
  const payload: ReceiptTokenPayload = {
    receiptId,
    issuedAt,
    version: TOKEN_VERSION,
  };

  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = signValue(payloadEncoded, getSecret());
  return `${payloadEncoded}.${signature}`;
};

export const parseReceiptVerificationToken = (token: string): ReceiptTokenPayload => {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    throw createError({ statusCode: 400, statusMessage: "Token de verificación inválido." });
  }

  const expectedSignature = signValue(payloadEncoded, getSecret());
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw createError({ statusCode: 401, statusMessage: "Firma de verificación inválida." });
  }

  let parsed: ReceiptTokenPayload;
  try {
    parsed = JSON.parse(fromBase64Url(payloadEncoded)) as ReceiptTokenPayload;
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Payload de verificación inválido." });
  }

  if (!parsed.receiptId || parsed.version !== TOKEN_VERSION || !parsed.issuedAt) {
    throw createError({ statusCode: 400, statusMessage: "Token de verificación incompleto." });
  }

  if (Date.now() - parsed.issuedAt > TOKEN_MAX_AGE_MS) {
    throw createError({ statusCode: 401, statusMessage: "Token de verificación expirado." });
  }

  return parsed;
};

export const buildReceiptVerificationUrl = (receiptId: string): string => {
  const config = useRuntimeConfig();
  const token = buildReceiptVerificationToken(receiptId);
  const path = `/api/receipts/v/${encodeURIComponent(token)}`;
  const baseUrl = String(config.public.appBaseUrl ?? "").trim();

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/+$/, "")}${path}`;
};

export const getReceiptFormatFromOrganization = (
  org: Pick<Database["public"]["Tables"]["organizations"]["Row"], "default_receipt_format"> | null | undefined,
): ReceiptFormat => {
  if (org?.default_receipt_format === "half_letter") {
    return "half_letter";
  }
  return "thermal";
};

export const sanitizeReceiptFormat = (value: string | null | undefined): ReceiptFormat | null => {
  if (value === "thermal" || value === "half_letter") return value;
  return null;
};

export const buildReceiptVerificationSummary = (
  transaction: Pick<TransactionRow, "invoice_number" | "created_at" | "final_amount" | "status">,
  branch: Pick<BranchRow, "name"> | null,
) => {
  return {
    invoiceNumber: transaction.invoice_number,
    issuedAt: transaction.created_at,
    totalAmount: Number(transaction.final_amount ?? 0),
    status: transaction.status ?? "completed",
    branchName: branch?.name ?? "Sucursal",
  };
};
