import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { H3Event } from "h3";
import type { Database, Tables } from "@/types/database.types";

type AdminClient = ReturnType<typeof createClient<Database>>;
type ProfileRow = Tables<"profiles">;

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

export interface TenantProfileData {
  id: string;
  full_name: string;
  email: string;
  role: Database["public"]["Enums"]["user_role"];
  organization_id: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface TenantProfileUpdateInput {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface TenantPasswordChangeInput {
  current_password: string;
  new_password: string;
}

export async function getTenantProfile(
  event: H3Event,
  userId: string,
): Promise<TenantProfileData> {
  const adminClient = buildAdminClient(event);

  const { data, error } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, organization_id, avatar_url, phone, is_active")
    .eq("id", userId)
    .single<TenantProfileData>();

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: error?.message ?? "No se encontro el perfil.",
    });
  }

  return data;
}

export async function updateTenantProfile(
  event: H3Event,
  userId: string,
  organizationId: string,
  input: TenantProfileUpdateInput,
): Promise<TenantProfileData> {
  const adminClient = buildAdminClient(event);

  const updates: Partial<ProfileRow> = {};
  if (input.full_name !== undefined) updates.full_name = input.full_name;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.avatar_url !== undefined) updates.avatar_url = input.avatar_url;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .select("id, full_name, email, role, organization_id, avatar_url, phone, is_active")
    .single<TenantProfileData>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo actualizar el perfil.",
    });
  }

  return data;
}

export async function changeTenantPassword(
  event: H3Event,
  userId: string,
  input: TenantPasswordChangeInput,
): Promise<void> {
  const adminClient = buildAdminClient(event);

  const { error: signInError } = await adminClient.auth.signInWithPassword({
    email: (await getTenantProfile(event, userId)).email,
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
