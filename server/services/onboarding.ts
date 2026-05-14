import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database, Json } from "@/types/database.types";
import {
  buildOrganizationLogoStoragePath,
  sanitizeText,
  sanitizeNullableText,
} from "@/utils/onboarding";

type AdminClient = ReturnType<typeof createClient<Database>>;

const buildAdminClient = (event: H3Event): AdminClient => {
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuracion de Supabase incompleta.",
    });
  }

  return createClient<Database, "public">(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export interface CreateOrganizationInput {
  organizationName: string;
  businessType: "products" | "services" | "hybrid";
  country: string;
  currency: string;
  timezone: string;
  billingMode: "monthly" | "quarterly" | "annual";
  fullName: string;
  email: string;
  phone?: string | null;
}

export interface CreateOrganizationResult {
  organizationId: string;
  logoUrl?: string | null;
}

export async function createOnboardingOrganization(
  event: H3Event,
  userId: string,
  input: CreateOrganizationInput,
  logoFile?: { data: Buffer; name: string; type: string } | null,
): Promise<CreateOrganizationResult> {
  const adminClient = buildAdminClient(event);

  const { data: organizationId, error: createError } = await adminClient.rpc(
    "create_onboarding_organization",
    {
      p_name: sanitizeText(input.organizationName),
      p_business_type: input.businessType,
      p_country: input.country,
      p_currency: input.currency,
      p_timezone: input.timezone,
      p_billing_mode: input.billingMode,
      p_slug: null as unknown as string,
      p_address: null as unknown as string,
      p_billing_data: null,
      p_full_name: sanitizeText(input.fullName),
      p_email: sanitizeText(input.email),
      p_phone: input.phone ?? undefined,
    },
  );

  if (createError || !organizationId) {
    throw createError ?? new Error("No se pudo crear la organizacion.");
  }

  let logoUrl: string | null = null;
  if (logoFile) {
    const storagePath = buildOrganizationLogoStoragePath(userId, organizationId, logoFile.type);

    const { error: uploadError } = await adminClient.storage
      .from("organization-assets")
      .upload(storagePath, logoFile.data, { upsert: true, contentType: logoFile.type });

    if (uploadError) throw uploadError;

    const { data } = adminClient.storage.from("organization-assets").getPublicUrl(storagePath);
    logoUrl = data.publicUrl;

    if (logoUrl) {
      const { error: logoUpdateError } = await adminClient
        .from("organizations")
        .update({ logo_url: logoUrl })
        .eq("id", organizationId);
      if (logoUpdateError) throw logoUpdateError;
    }
  }

  await adminClient.from("onboarding_progress").upsert({
    user_id: userId,
    organization_id: organizationId,
    current_step: "payment",
    progress_data: { organizationId } as Json,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return { organizationId, logoUrl };
}

export interface PaymentStatusSummary {
  status: "missing" | "pending" | "approved" | "rejected";
  latestValidation: Database["public"]["Tables"]["payment_validations"]["Row"] | null;
}

export async function getPaymentStatus(
  event: H3Event,
  organizationId: string,
): Promise<PaymentStatusSummary> {
  const adminClient = buildAdminClient(event);

  const { data, error: queryError } = await adminClient
    .from("payment_validations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) {
    throw createError({
      statusCode: 500,
      statusMessage: queryError.message,
    });
  }

  if (!data) {
    return { status: "missing", latestValidation: null };
  }

  return {
    status: (data.status ?? "pending") as PaymentStatusSummary["status"],
    latestValidation: data,
  };
}

export interface UploadReceiptInput {
  organizationId: string;
  userId: string;
  amount: number;
  paymentMethod: "bank_transfer" | "qr_payment" | "card" | "paypal" | "other";
  transactionRef?: string | null;
  file: { data: Buffer; name: string; type: string };
}

export async function uploadReceipt(
  event: H3Event,
  input: UploadReceiptInput,
) {
  const adminClient = buildAdminClient(event);

  const safeFilename = input.file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  const storagePath = `${input.userId}/${input.organizationId}/${Date.now()}_${safeFilename}`;

  const { error: uploadError } = await adminClient.storage
    .from("receipts")
    .upload(storagePath, input.file.data, {
      upsert: false,
      contentType: input.file.type,
    });

  if (uploadError) {
    throw createError({
      statusCode: 400,
      statusMessage: uploadError.message,
    });
  }

  const { data: validation, error: insertError } = await adminClient
    .from("payment_validations")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      transaction_ref: sanitizeNullableText(input.transactionRef),
      receipt_storage_path: storagePath,
      receipt_filename: safeFilename,
      receipt_mime_type: input.file.type,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    throw createError({
      statusCode: 500,
      statusMessage: insertError.message,
    });
  }

  await adminClient.from("audit_logs").insert({
    action: "INSERT",
    table_name: "payment_validations",
    record_id: validation.id,
    user_id: input.userId,
    context: {
      event: "PAYMENT_RECEIPT_SUBMITTED",
      organization_id: input.organizationId,
      receipt_storage_path: storagePath,
      amount: input.amount,
    } as Json,
  });

  return validation;
}

export async function getOrganizationSlug(
  event: H3Event,
  organizationId: string,
): Promise<string> {
  const adminClient = buildAdminClient(event);

  const { data, error } = await adminClient
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return data?.slug ?? "mi-organizacion";
}

