import { createClient } from "@supabase/supabase-js";
import { createError, readBody } from "h3";
import { serverSupabaseUser } from "#supabase/server";

import { clientUpsertSchema } from "@/types/client";

import type { H3Event } from "h3";

type ProfileRole = "admin" | "manager" | "employee" | "client" | null;
type OrgStatus = "active" | "inactive" | "blocked";
type ResolvedRole = "admin" | "manager" | "employee" | "client" | "guest";

const sanitizeNullableString = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const getUserMetadataOrgId = (user: { user_metadata?: unknown }): string | null => {
  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  const organizationId = metadata.organization_id;

  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
};

const buildServerClient = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NUXT_PUBLIC_SUPABASE_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuración de Supabase incompleta.",
    });
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const resolveRole = (
  profileRole: ProfileRole,
  orgStatus: OrgStatus | null,
): ResolvedRole => {
  if (profileRole === "admin" || profileRole === "manager" || profileRole === "employee") {
    return profileRole;
  }

  if (orgStatus === "active") {
    return "client";
  }

  return "guest";
};

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event);
  if (!authUser) {
    throw createError({
      statusCode: 401,
      statusMessage: "No autorizado.",
    });
  }

  const body = await readBody(event);
  const parsed = clientUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  const payload = parsed.data;
  const adminClient = buildServerClient(event);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("organization_id, role")
    .eq("id", authUser.id)
    .maybeSingle<{
      organization_id: string | null;
      role: ProfileRole;
    }>();

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: profileError.message,
    });
  }

  const organizationId = profile?.organization_id
    ?? getUserMetadataOrgId(authUser)
    ?? sanitizeNullableString(payload.organizationId);

  if (!organizationId) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo resolver organization_id desde la sesión.",
    });
  }

  const phone = sanitizeNullableString(payload.phone);
  const email = sanitizeNullableString(payload.email);

  if (!phone && !email) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes enviar al menos phone o email.",
    });
  }

  let existingClient: {
    id: string;
    user_id: string | null;
    first_name: string;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    billing_data: Record<string, unknown>;
    preferences: Record<string, unknown>;
  } | null = null;

  if (phone && email) {
    const { data, error } = await adminClient
      .from("clients")
      .select("id, user_id, first_name, last_name, phone, email, billing_data, preferences")
      .or(`phone.eq.${phone},email.eq.${email}`)
      .limit(1)
      .maybeSingle<{
        id: string;
        user_id: string | null;
        first_name: string;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        billing_data: Record<string, unknown>;
        preferences: Record<string, unknown>;
      }>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    existingClient = data ?? null;
  } else if (phone) {
    const { data, error } = await adminClient
      .from("clients")
      .select("id, user_id, first_name, last_name, phone, email, billing_data, preferences")
      .eq("phone", phone)
      .maybeSingle<{
        id: string;
        user_id: string | null;
        first_name: string;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        billing_data: Record<string, unknown>;
        preferences: Record<string, unknown>;
      }>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    existingClient = data ?? null;
  } else if (email) {
    const { data, error } = await adminClient
      .from("clients")
      .select("id, user_id, first_name, last_name, phone, email, billing_data, preferences")
      .eq("email", email)
      .maybeSingle<{
        id: string;
        user_id: string | null;
        first_name: string;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        billing_data: Record<string, unknown>;
        preferences: Record<string, unknown>;
      }>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    existingClient = data ?? null;
  }

  let clientId = existingClient?.id ?? null;

  if (!clientId) {
    const { data, error } = await adminClient
      .from("clients")
      .insert({
        user_id: authUser.id,
        first_name: payload.firstName,
        last_name: sanitizeNullableString(payload.lastName ?? null),
        phone,
        email,
        billing_data: payload.billingData ?? {},
        preferences: payload.preferences ?? {},
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
        user_id: existingClient?.user_id ?? authUser.id,
        first_name: payload.firstName,
        last_name: sanitizeNullableString(payload.lastName ?? null),
        phone,
        email,
        billing_data: payload.billingData ?? existingClient?.billing_data ?? {},
        preferences: payload.preferences ?? existingClient?.preferences ?? {},
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
      organization_id: organizationId,
      status: "active",
      billing_data: payload.billingData ?? {},
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "client_id,organization_id",
    });

  if (linkError) {
    throw createError({
      statusCode: 500,
      statusMessage: linkError.message,
    });
  }

  const { data: clientOrg, error: clientOrgError } = await adminClient
    .from("client_org")
    .select("status")
    .eq("client_id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ status: OrgStatus }>();

  if (clientOrgError) {
    throw createError({
      statusCode: 500,
      statusMessage: clientOrgError.message,
    });
  }

  const orgStatus = clientOrg?.status ?? "inactive";
  const role = resolveRole(profile?.role ?? null, orgStatus);

  return {
    id: clientId,
    role,
    orgStatus,
  };
});
