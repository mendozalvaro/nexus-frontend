import { createError } from "h3";

import type { H3Event } from "h3";
import type { ActorType, UserRole } from "@/types/auth";
import type { Database } from "@/types/database.types";
import {
  createAdminServerClient,
  resolveAuthUserId,
  resolveServerAuthenticatedUser,
} from "./auth-server";

type AdminClient = ReturnType<typeof createAdminServerClient>;
type AuthenticatedServerUser = NonNullable<Awaited<ReturnType<typeof resolveServerAuthenticatedUser>>>;

type ProfileSummary = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "organization_id" | "role" | "role_id" | "full_name" | "email" | "avatar_url" | "phone" | "is_active"
>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROLE_SET = new Set<UserRole>([
  "admin",
  "manager",
  "employee",
  "client",
]);

const normalizeRole = (value: unknown): UserRole | null => {
  if (typeof value !== "string") {
    return null;
  }

  return ROLE_SET.has(value as UserRole)
    ? (value as UserRole)
    : null;
};

const isSystemRole = (value: unknown): value is "system" | "support" => {
  return value === "system" || value === "support";
};

const resolveActorType = (
  profile: ProfileSummary | null,
  hasSystemAccess: boolean,
  preferSystem: boolean,
): ActorType => {
  if (preferSystem && hasSystemAccess) {
    return "system";
  }

  if (profile?.role === "client") {
    return "client";
  }

  if (profile?.role === "admin" || profile?.role === "manager" || profile?.role === "employee") {
    return "staff";
  }

  return hasSystemAccess ? "system" : "guest";
};

export interface ServerActorContext {
  adminClient: AdminClient;
  user: AuthenticatedServerUser;
  userId: string;
  profile: ProfileSummary | null;
  role: UserRole | null;
  actorType: ActorType;
  hasSystemAccess: boolean;
  systemRole: "system" | "support" | null;
}

export const requireActorContext = async (
  event: H3Event,
  options: {
    preferSystem?: boolean;
  } = {},
): Promise<ServerActorContext> => {
  const user = await resolveServerAuthenticatedUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "No autorizado." });
  }

  const userId = resolveAuthUserId(user);
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError({ statusCode: 401, statusMessage: "Sesion invalida: user id no valido." });
  }

  const adminClient = createAdminServerClient(event);

  const [{ data: profile, error: profileError }, { data: systemUser, error: systemError }] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, organization_id, role, role_id, full_name, email, avatar_url, phone, is_active")
      .eq("id", userId)
      .maybeSingle<ProfileSummary>(),
    adminClient
      .from("system_users")
      .select("user_id, role, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: `No se pudo cargar perfil para contexto actor: ${profileError.message}`,
    });
  }

  if (systemError) {
    throw createError({
      statusCode: 500,
      statusMessage: `No se pudo cargar acceso system para contexto actor: ${systemError.message}`,
    });
  }

  const role = profile?.role
    ?? normalizeRole((user.user_metadata as { role?: unknown } | null | undefined)?.role)
    ?? normalizeRole((user.app_metadata as { role?: unknown } | null | undefined)?.role)
    ?? null;
  const systemRole = isSystemRole(systemUser?.role) ? systemUser.role : null;
  const hasSystemAccess = Boolean(systemUser && systemRole);

  return {
    adminClient,
    user,
    userId,
    profile: profile ?? null,
    role,
    actorType: resolveActorType(profile ?? null, hasSystemAccess, options.preferSystem === true),
    hasSystemAccess,
    systemRole,
  };
};
