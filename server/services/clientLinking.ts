import { createError } from "h3";
import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export interface ResolveOrLinkClientInput {
  organizationId: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  billingData?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  userId?: string | null;
}

export interface ResolveOrLinkClientResult {
  client: ClientRow;
  orgStatus: string;
}

const sanitize = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const toJson = (value: unknown, fallback: Json = {}): Json => {
  return (value ?? fallback) as Json;
};

const resolveExistingClient = async (
  adminClient: AdminClient,
  phone: string | null,
  email: string | null,
): Promise<Pick<ClientRow, "id" | "user_id" | "billing_data" | "preferences"> | null> => {
  if (!phone && !email) {
    return null;
  }

  let query = adminClient
    .from("clients")
    .select("id, user_id, billing_data, preferences")
    .limit(1);

  if (phone && email) {
    query = query.or(`phone.eq.${phone},email.eq.${email}`);
  } else if (phone) {
    query = query.eq("phone", phone);
  } else if (email) {
    query = query.eq("email", email);
  }

  const { data, error } = await query;
  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  const rows = (data ?? []) as Array<Pick<ClientRow, "id" | "user_id" | "billing_data" | "preferences">>;
  return rows[0] ?? null;
};

export async function resolveOrLinkClient(
  adminClient: AdminClient,
  input: ResolveOrLinkClientInput,
): Promise<ResolveOrLinkClientResult> {
  const firstName = sanitize(input.firstName);
  const lastName = sanitize(input.lastName);
  const phone = sanitize(input.phone);
  const email = sanitize(input.email);

  if (!firstName) {
    throw createError({
      statusCode: 400,
      statusMessage: "El nombre del cliente es obligatorio.",
    });
  }

  if (!phone && !email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes enviar al menos phone o email.",
    });
  }

  const existing = await resolveExistingClient(adminClient, phone, email);
  const persistedBilling = toJson(input.billingData, {});
  const persistedPreferences = toJson(input.preferences, {});

  let clientId = existing?.id ?? null;
  if (!clientId) {
    const { data, error } = await adminClient
      .from("clients")
      .insert({
        user_id: input.userId ?? null,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        billing_data: persistedBilling,
        preferences: persistedPreferences,
      })
      .select("*")
      .single<ClientRow>();

    if (error || !data) {
      throw createError({
        statusCode: 500,
        statusMessage: error?.message ?? "No se pudo crear el cliente.",
      });
    }

    clientId = data.id;
  } else {
    const { error } = await adminClient
      .from("clients")
      .update({
        user_id: existing?.user_id ?? input.userId ?? null,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        billing_data: toJson(input.billingData, toJson(existing?.billing_data, {})),
        preferences: toJson(input.preferences, toJson(existing?.preferences, {})),
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }
  }

  const { error: linkError } = await adminClient
    .from("client_org")
    .upsert({
      client_id: clientId,
      organization_id: input.organizationId,
      status: "active",
      billing_data: persistedBilling,
      updated_at: new Date().toISOString(),
      is_anonymous_template: false,
    }, { onConflict: "client_id,organization_id" });

  if (linkError) {
    throw createError({
      statusCode: 500,
      statusMessage: linkError.message,
    });
  }

  const { data: linkedClient, error: linkedClientError } = await adminClient
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single<ClientRow>();

  if (linkedClientError || !linkedClient) {
    throw createError({
      statusCode: 500,
      statusMessage: linkedClientError?.message ?? "No se pudo resolver el cliente vinculado.",
    });
  }

  const { data: clientOrg, error: clientOrgError } = await adminClient
    .from("client_org")
    .select("status")
    .eq("client_id", clientId)
    .eq("organization_id", input.organizationId)
    .maybeSingle<{ status: string }>();

  if (clientOrgError) {
    throw createError({
      statusCode: 500,
      statusMessage: clientOrgError.message,
    });
  }

  return {
    client: linkedClient,
    orgStatus: clientOrg?.status ?? "inactive",
  };
}
