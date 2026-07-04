import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

export type PublicAdminClient = ReturnType<typeof createClient<Database>>;

export const buildPublicAdminClient = (event: H3Event): PublicAdminClient => {
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
