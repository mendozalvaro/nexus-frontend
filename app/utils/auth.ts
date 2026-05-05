import type { UserRole } from "@/types/auth";

export const MIN_PASSWORD_LENGTH = 8;
export const PROFILE_CACHE_TTL_MS = 30_000;

export const sanitizeString = (value: string | null | undefined): string => {
  return value?.trim() ?? "";
};

export const sanitizeNullableString = (value: string | null | undefined): string | null => {
  const sanitized = sanitizeString(value);
  return sanitized.length > 0 ? sanitized : null;
};

export const sanitizeAuthEmail = (email: string): string => {
  return sanitizeString(email).toLowerCase();
};

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidUuid = (value: string | null | undefined): boolean => {
  const sanitized = sanitizeNullableString(value);
  if (!sanitized) {
    return false;
  }

  if (sanitized === "undefined" || sanitized === "null") {
    return false;
  }

  return UUID_REGEX.test(sanitized);
};

export const sanitizeRole = (role?: UserRole | null, isPublic = false): UserRole => {
  if (isPublic || !role) {
    return "client";
  }

  return role;
};

export const isStaffRole = (
  value: UserRole | null | undefined,
): value is Exclude<UserRole, "client"> => {
  return value === "admin" || value === "manager" || value === "employee";
};

export const createPermissionDeniedMessage = (): string => {
  return "No tienes permisos para realizar esta acción.";
};
