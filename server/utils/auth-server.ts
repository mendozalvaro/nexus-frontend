import { createClient } from "@supabase/supabase-js";
import { createError, getHeader } from "h3";
import { serverSupabaseUser } from "#supabase/server";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;
type AuthValidationClient = ReturnType<typeof createClient<Database>>;
type UserServerClient = ReturnType<typeof createClient<Database>>;

export interface AuthServerContext {
  adminClient: AdminClient;
  userId: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveAuthUserId = (user: unknown): string | null => {
  if (!user || typeof user !== "object") {
    return null;
  }

  const candidate =
    (user as { id?: unknown }).id
    ?? (user as { sub?: unknown }).sub;

  return typeof candidate === "string" ? candidate : null;
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url =
    (config.public?.supabase as { url?: string } | undefined)?.url
    ?? process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    (config.public?.supabase as { key?: string } | undefined)?.key
    ?? process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseConfig = config.supabase as { secretKey?: string; serviceKey?: string } | undefined;
  const serviceRoleKey =
    config.supabaseServiceRoleKey as string | undefined
    ?? supabaseConfig?.secretKey
    ?? supabaseConfig?.serviceKey;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuración pública de Supabase incompleta para auth server context.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuración de Supabase incompleta para auth server context.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const createAuthValidationClient = (event: H3Event): AuthValidationClient => {
  const { url, anonKey } = getSupabaseServerConfig(event);

  return createClient<Database, "public">(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const resolveBearerToken = (event: H3Event): string | null => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
};

export const createUserServerClient = (
  event: H3Event,
  accessToken: string,
): UserServerClient => {
  const { url, anonKey } = getSupabaseServerConfig(event);

  return createClient<Database, "public">(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

export const resolveServerAuthenticatedUser = async (event: H3Event) => {
  const bearerToken = resolveBearerToken(event);
  if (bearerToken) {
    const authClient = createAuthValidationClient(event);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(bearerToken);
    const claimsUserId = resolveAuthUserId(claimsData?.claims ?? null);
    if (!claimsError && claimsUserId && UUID_REGEX.test(claimsUserId)) {
      const adminClient = createAdminServerClient(event);
      const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(claimsUserId);
      if (!authError && authData.user) {
        return authData.user;
      }
    }

    const userClient = createUserServerClient(event, bearerToken);
    const { data: fallbackData, error: fallbackError } = await userClient.auth.getUser();
    if (!fallbackError && fallbackData.user) {
      return fallbackData.user;
    }
  }

  const cookieUser = await serverSupabaseUser(event);
  if (cookieUser) {
    return cookieUser;
  }

  return null;
};

export const createAdminServerClient = (event: H3Event): AdminClient => {
  const { url, serviceRoleKey } = getSupabaseServerConfig(event);

  return createClient<Database, "public">(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const requireAuthServerContext = async (event: H3Event): Promise<AuthServerContext> => {
  const user = await resolveServerAuthenticatedUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autorizado." });
  }

  const userId = resolveAuthUserId(user);
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError({ statusCode: 401, statusMessage: "Sesion invalida: user id no valido." });
  }

  return {
    adminClient: createAdminServerClient(event),
    userId,
  };
};

export { resolveAuthUserId };
