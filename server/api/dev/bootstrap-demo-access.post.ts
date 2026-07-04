import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";

import { assertValidDevAdminKey } from "../../utils/dev-security";

import type { Database } from "@/types/database.types";
import type { H3Event } from "h3";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

const bootstrapSchema = {
  defaultSlug: "moda-calida",
  defaultEmail: "admin.modacalida@nexuspos.demo",
  defaultPassword: "Demo123456!",
  defaultFullName: "Martina Calida",
} as const;

export default defineEventHandler(async (event: H3Event) => {
  if (process.env.NODE_ENV === "production") {
    throw createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
  }

  const config = useRuntimeConfig(event);
  const devAdminKey = config.devAdminKey as string | undefined;
  const requestKey = getHeader(event, "x-dev-admin-key");
  assertValidDevAdminKey(requestKey ?? undefined, devAdminKey);

  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;
  if (!url || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Supabase configuration incomplete",
    });
  }

  const body = await readBody<{
    organizationSlug?: string;
    email?: string;
    password?: string;
    fullName?: string;
  }>(event);

  const organizationSlug = (body.organizationSlug ?? bootstrapSchema.defaultSlug).trim().toLowerCase();
  const email = (body.email ?? bootstrapSchema.defaultEmail).trim().toLowerCase();
  const password = (body.password ?? bootstrapSchema.defaultPassword).trim();
  const fullName = (body.fullName ?? bootstrapSchema.defaultFullName).trim();

  if (!organizationSlug || !email || !password || !fullName) {
    throw createError({
      statusCode: 400,
      statusMessage: "organizationSlug, email, password y fullName son obligatorios.",
    });
  }

  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: organization, error: organizationError } = await adminClient
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", organizationSlug)
    .maybeSingle<Pick<OrganizationRow, "id" | "name" | "slug">>();

  if (organizationError || !organization) {
    throw createError({
      statusCode: 404,
      statusMessage: organizationError?.message ?? "No se encontro la organizacion demo.",
    });
  }

  const { data: branch } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<BranchRow, "id" | "name">>();

  const { data: users, error: listUsersError } = await adminClient.auth.admin.listUsers();
  if (listUsersError) {
    throw createError({
      statusCode: 500,
      statusMessage: listUsersError.message,
    });
  }

  const existingAuthUser = users.users.find((user) => user.email?.toLowerCase() === email) ?? null;

  let userId = existingAuthUser?.id ?? null;

  if (!existingAuthUser) {
    const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_slug: organization.slug,
        role: "admin",
      },
    });

    if (createAuthError || !createdAuth.user) {
      throw createError({
        statusCode: 500,
        statusMessage: createAuthError?.message ?? "No se pudo crear el usuario demo en Auth.",
      });
    }

    userId = createdAuth.user.id;
  } else {
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existingAuthUser.user_metadata ?? {}),
        full_name: fullName,
        organization_slug: organization.slug,
        role: "admin",
      },
    });

    if (updateAuthError) {
      throw createError({
        statusCode: 500,
        statusMessage: updateAuthError.message,
      });
    }

    userId = existingAuthUser.id;
  }

  if (!userId) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo resolver el usuario demo.",
    });
  }

  const profilePayload: ProfileInsert = {
    id: userId,
    organization_id: organization.id,
    full_name: fullName,
    email,
    role: "admin",
    is_active: true,
  };

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: profileError.message,
    });
  }

  return {
    success: true,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    branch: branch ?? null,
    credentials: {
      email,
      password,
      role: "admin",
      loginPath: "/auth/login",
      catalogPath: `/${organization.slug}/catalog`,
    },
  };
});
