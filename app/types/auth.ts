import type { User } from "@supabase/supabase-js";

import type { Database, Json, Tables, TablesInsert } from "./database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type AuditAction = Database["public"]["Enums"]["audit_action"];
export type AuthAudience = "staff" | "client";
export type AuthOAuthProvider = "google";
export type ActorType = "guest" | "client" | "staff" | "system";
export type ActorAccessState = "unauthenticated" | "profile_incomplete" | "authenticated";
export type Profile = Tables<"profiles">;
export type ProfileInsert = TablesInsert<"profiles">;
export type AuditLogInsert = TablesInsert<"audit_logs">;

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  organizationId?: string | null;
  isPublic?: boolean;
}

export interface UpdateProfileInput {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface AuthOperationResult<T = void> {
  data: T | null;
  error: string | null;
}

export interface SignInOptions {
  resolveProfile?: boolean;
}

export interface SignInWithProviderOptions {
  audience: AuthAudience;
  redirect?: string | null;
  slug?: string | null;
}

export interface SignOutOptions {
  redirectTo?: string | null;
}

export interface AuthErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface AuthAuditContext {
  event:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "SIGN_UP"
    | "SIGN_OUT"
    | "PROFILE_UPDATED"
    | "PERMISSION_DENIED";
  email?: string;
  organization_id?: string | null;
  role?: UserRole | null;
  reason?: string;
  metadata?: Json;
  [key: string]: Json | undefined;
}

export interface AuthMetadata {
  full_name?: string;
  organization_id?: string | null;
  role?: UserRole | null;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  organizationId: string | null;
  role: UserRole | null;
}

export interface ActorContextPayload {
  actorType: ActorType;
  accessState: ActorAccessState;
  hasSystemAccess: boolean;
  systemRole: "system" | "support" | null;
  user: User | null;
  profile: Profile | null;
}

export type AuthBootstrapState =
  | "idle"
  | "resolving"
  | "authenticated"
  | "unauthenticated"
  | "profile_incomplete";
