import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";
import { serverSupabaseUser } from "#supabase/server";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;

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

export const createAdminServerClient = (event: H3Event): AdminClient => {
  const config = useRuntimeConfig(event);
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuración de Supabase incompleta para auth server context.",
    });
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const requireAuthServerContext = async (event: H3Event): Promise<AuthServerContext> => {
  const user = await serverSupabaseUser(event);
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
