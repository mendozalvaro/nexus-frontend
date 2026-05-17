import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database, Json } from "@/types/database.types";
import type { ClientProfileState } from "@/types/client";

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

export async function getClientProfile(
  event: H3Event,
  userId: string,
  organizationId: string,
): Promise<ClientProfileState | null> {
  const adminClient = buildAdminClient(event);

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("id, first_name, last_name, phone, email, billing_data, preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (clientError) {
    throw createError({ statusCode: 500, statusMessage: clientError.message });
  }

  if (!client) return null;

  const { data: clientOrg, error: clientOrgError } = await adminClient
    .from("client_org")
    .select("status, organization_id, billing_data")
    .eq("client_id", client.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (clientOrgError) {
    throw createError({ statusCode: 500, statusMessage: clientOrgError.message });
  }

  if (!clientOrg) return null;

  return {
    clientId: client.id,
    organizationId: clientOrg.organization_id,
    orgStatus: clientOrg.status as "active" | "inactive" | "blocked",
    firstName: client.first_name,
    lastName: client.last_name,
    phone: client.phone,
    email: client.email,
    billingData: (clientOrg.billing_data ?? client.billing_data ?? {}) as Record<string, unknown>,
    preferences: (client.preferences ?? {}) as Record<string, unknown>,
  };
}

export interface ClientUpsertInput {
  organizationId?: string | null;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  billingData?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface ClientUpsertResult {
  id: string;
  role: string;
  orgStatus: string;
}

export async function upsertClientProfile(
  event: H3Event,
  userId: string,
  input: ClientUpsertInput,
  profileOrgId?: string | null,
  profileRole?: string | null,
): Promise<ClientUpsertResult> {
  const adminClient = buildAdminClient(event);

  const sanitize = (v: string | null | undefined) => {
    const normalized = v?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  };

  const organizationId = profileOrgId ?? sanitize(input.organizationId);
  if (!organizationId) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo resolver organization_id.",
    });
  }

  const phone = sanitize(input.phone);
  const email = sanitize(input.email);

  if (!phone && !email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes enviar al menos phone o email.",
    });
  }

  let existingClient: {
    id: string;
    user_id: string | null;
    billing_data: unknown;
    preferences: unknown;
  } | null = null;

  if (phone && email) {
    const { data, error } = await adminClient
      .from("clients")
      .select("id, user_id, billing_data, preferences")
      .or(`phone.eq.${phone},email.eq.${email}`)
      .limit(1)
      .maybeSingle();

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    existingClient = data ?? null;
  } else if (phone) {
    const { data, error } = await adminClient
      .from("clients")
      .select("id, user_id, billing_data, preferences")
      .eq("phone", phone)
      .maybeSingle();

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    existingClient = data ?? null;
  } else {
    const { data, error } = await adminClient
      .from("clients")
      .select("id, user_id, billing_data, preferences")
      .eq("email", email!)
      .maybeSingle();

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    existingClient = data ?? null;
  }

  let clientId = existingClient?.id ?? null;

  if (!clientId) {
    const { data, error } = await adminClient
      .from("clients")
      .insert({
        user_id: userId,
        first_name: input.firstName,
        last_name: sanitize(input.lastName),
        phone,
        email,
        billing_data: (input.billingData ?? {}) as Json,
        preferences: (input.preferences ?? {}) as Json,
      })
      .select("id")
      .single<{ id: string }>();

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
        user_id: existingClient?.user_id ?? userId,
        first_name: input.firstName,
        last_name: sanitize(input.lastName),
        phone,
        email,
        billing_data: (input.billingData ?? existingClient?.billing_data ?? {}) as Json,
        preferences: (input.preferences ?? existingClient?.preferences ?? {}) as Json,
      })
      .eq("id", clientId);

    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const { error: linkError } = await adminClient
    .from("client_org")
    .upsert({
      client_id: clientId,
      organization_id: organizationId,
      status: "active",
      billing_data: (input.billingData ?? {}) as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id,organization_id" });

  if (linkError) {
    throw createError({ statusCode: 500, statusMessage: linkError.message });
  }

  const { data: clientOrg } = await adminClient
    .from("client_org")
    .select("status")
    .eq("client_id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ status: string }>();

  const orgStatus = clientOrg?.status ?? "inactive";

  const resolveRole = (pRole: string | null, oStatus: string): string => {
    if (pRole === "admin" || pRole === "manager" || pRole === "employee") return pRole;
    if (oStatus === "active") return "client";
    return "guest";
  };

  const role = resolveRole(profileRole ?? null, orgStatus);

  return { id: clientId, role, orgStatus };
}

export interface ClientProfileUpdateInput {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  billingData?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export async function updateClientProfile(
  event: H3Event,
  userId: string,
  organizationId: string,
  input: ClientProfileUpdateInput,
): Promise<ClientProfileState> {
  const adminClient = buildAdminClient(event);

  const sanitize = (v: string | null | undefined) => {
    const normalized = v?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  };

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("id, user_id, first_name, last_name, phone, email, billing_data, preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (clientError) {
    throw createError({ statusCode: 500, statusMessage: clientError.message });
  }

  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontro el perfil de cliente.",
    });
  }

  const { data: clientOrg, error: clientOrgError } = await adminClient
    .from("client_org")
    .select("status, organization_id, billing_data")
    .eq("client_id", client.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (clientOrgError) {
    throw createError({ statusCode: 500, statusMessage: clientOrgError.message });
  }

  if (!clientOrg) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontro la vinculacion cliente-organizacion.",
    });
  }

  const { error: updateClientError } = await adminClient
    .from("clients")
    .update({
      first_name: input.firstName,
      last_name: sanitize(input.lastName),
      phone: sanitize(input.phone),
      email: sanitize(input.email),
      billing_data: (input.billingData ?? client.billing_data ?? {}) as Json,
      preferences: (input.preferences ?? client.preferences ?? {}) as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (updateClientError) {
    throw createError({
      statusCode: 500,
      statusMessage: updateClientError.message,
    });
  }

  if (input.billingData) {
    const { error: updateOrgError } = await adminClient
      .from("client_org")
      .update({
        billing_data: input.billingData as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", client.id)
      .eq("organization_id", organizationId);

    if (updateOrgError) {
      throw createError({
        statusCode: 500,
        statusMessage: updateOrgError.message,
      });
    }
  }

  const { data: refreshedClient, error: refetchError } = await adminClient
    .from("clients")
    .select("id, first_name, last_name, phone, email, billing_data, preferences")
    .eq("id", client.id)
    .maybeSingle();

  if (refetchError || !refreshedClient) {
    throw createError({
      statusCode: 500,
      statusMessage: refetchError?.message ?? "No se pudo refrescar el perfil.",
    });
  }

  const { data: refreshedOrg, error: refetchOrgError } = await adminClient
    .from("client_org")
    .select("status, organization_id, billing_data")
    .eq("client_id", client.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (refetchOrgError || !refreshedOrg) {
    throw createError({
      statusCode: 500,
      statusMessage: refetchOrgError?.message ?? "No se pudo refrescar la vinculacion.",
    });
  }

  return {
    clientId: refreshedClient.id,
    organizationId: refreshedOrg.organization_id,
    orgStatus: refreshedOrg.status as "active" | "inactive" | "blocked",
    firstName: refreshedClient.first_name,
    lastName: refreshedClient.last_name,
    phone: refreshedClient.phone,
    email: refreshedClient.email,
    billingData: (refreshedOrg.billing_data ?? refreshedClient.billing_data ?? {}) as Record<string, unknown>,
    preferences: (refreshedClient.preferences ?? {}) as Record<string, unknown>,
  };
}

