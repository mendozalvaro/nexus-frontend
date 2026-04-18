import { createClient } from "@supabase/supabase-js";
import { createError, getQuery } from "h3";
import { z } from "zod";
import { serverSupabaseUser } from "#supabase/server";

import type { H3Event } from "h3";
import type { ClientProfileState } from "@/types/client";

const querySchema = z.object({
  organizationId: z.string().uuid("organizationId inválido."),
}).strict();

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

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event);
  if (!authUser) {
    return {
      profile: null,
    };
  }

  const parsedQuery = querySchema.safeParse(getQuery(event));
  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedQuery.error.issues[0]?.message ?? "Query inválida.",
    });
  }

  const { organizationId } = parsedQuery.data;
  const adminClient = buildServerClient(event);

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("id, first_name, last_name, phone, email, billing_data, preferences")
    .eq("user_id", authUser.id)
    .maybeSingle<{
      id: string;
      first_name: string;
      last_name: string | null;
      phone: string | null;
      email: string | null;
      billing_data: Record<string, unknown>;
      preferences: Record<string, unknown>;
    }>();

  if (clientError) {
    throw createError({
      statusCode: 500,
      statusMessage: clientError.message,
    });
  }

  if (!client) {
    return {
      profile: null,
    };
  }

  const { data: clientOrg, error: clientOrgError } = await adminClient
    .from("client_org")
    .select("status, organization_id, billing_data")
    .eq("client_id", client.id)
    .eq("organization_id", organizationId)
    .maybeSingle<{
      status: "active" | "inactive" | "blocked";
      organization_id: string;
      billing_data: Record<string, unknown>;
    }>();

  if (clientOrgError) {
    throw createError({
      statusCode: 500,
      statusMessage: clientOrgError.message,
    });
  }

  if (!clientOrg) {
    return {
      profile: null,
    };
  }

  const profile: ClientProfileState = {
    clientId: client.id,
    organizationId: clientOrg.organization_id,
    orgStatus: clientOrg.status,
    firstName: client.first_name,
    lastName: client.last_name,
    phone: client.phone,
    email: client.email,
    billingData: clientOrg.billing_data ?? client.billing_data ?? {},
    preferences: client.preferences ?? {},
  };

  return {
    profile,
  };
});
