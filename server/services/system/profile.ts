import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";

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
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export interface SystemProfileData {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemProfileUpdateInput {
  email: string;
  fullName: string;
  password?: string | null;
}

export interface SystemPasswordChangeInput {
  current_password: string;
  new_password: string;
}

export async function getSystemProfile(
  event: H3Event,
  userId: string,
): Promise<SystemProfileData> {
  const adminClient = buildAdminClient(event);

  const { data, error } = await adminClient
    .from("system_users")
    .select("user_id, email, full_name, role, is_active, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle<SystemProfileData>();

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: error?.message ?? "No se encontro el perfil system.",
    });
  }

  return data;
}

export async function updateSystemProfile(
  event: H3Event,
  userId: string,
  input: SystemProfileUpdateInput,
): Promise<SystemProfileData> {
  const adminClient = buildAdminClient(event);

  const authPayload: {
    email?: string;
    password?: string;
    user_metadata?: Record<string, unknown>;
  } = {
    email: input.email,
    user_metadata: { full_name: input.fullName },
  };

  if (input.password) {
    authPayload.password = input.password;
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, authPayload);
  if (authError) {
    throw createError({
      statusCode: 400,
      statusMessage: authError.message,
    });
  }

  const { data, error } = await adminClient
    .from("system_users")
    .update({
      email: input.email,
      full_name: input.fullName,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id, email, full_name, role, is_active, created_at, updated_at")
    .single<SystemProfileData>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo actualizar el perfil system.",
    });
  }

  return data;
}

export async function changeSystemPassword(
  event: H3Event,
  userId: string,
  input: SystemPasswordChangeInput,
): Promise<void> {
  const adminClient = buildAdminClient(event);

  const profile = await getSystemProfile(event, userId);
  if (!profile.email) {
    throw createError({
      statusCode: 400,
      statusMessage: "El perfil system no tiene email registrado.",
    });
  }

  const { error: signInError } = await adminClient.auth.signInWithPassword({
    email: profile.email,
    password: input.current_password,
  });

  if (signInError) {
    throw createError({
      statusCode: 400,
      statusMessage: "La contrasena actual es incorrecta.",
    });
  }

  if (input.new_password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: "La nueva contrasena debe tener al menos 8 caracteres.",
    });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: input.new_password,
  });

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: updateError.message,
    });
  }
}
