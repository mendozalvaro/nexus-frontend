import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import {
  buildReceiptVerificationSummary,
  parseReceiptVerificationToken,
} from "../../services/receipts/verification";

export default defineEventHandler(async (event) => {
  const token = getQuery(event).token;
  if (typeof token !== "string" || token.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Token de verificación requerido." });
  }

  const parsed = parseReceiptVerificationToken(token.trim());
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({ statusCode: 500, statusMessage: "Configuración de verificación incompleta." });
  }

  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: transaction, error: transactionError } = await adminClient
    .from("transactions")
    .select("id, organization_id, branch_id, invoice_number, created_at, final_amount, status")
    .eq("id", parsed.receiptId)
    .maybeSingle();

  if (transactionError || !transaction) {
    throw createError({ statusCode: 404, statusMessage: "Recibo no encontrado." });
  }

  const { data: branch } = await adminClient
    .from("branches")
    .select("name")
    .eq("id", transaction.branch_id)
    .maybeSingle();

  return {
    valid: true,
    receipt: buildReceiptVerificationSummary(transaction, branch),
  };
});
