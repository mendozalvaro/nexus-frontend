export const sanitizeInternalRedirect = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  return normalized;
};

export const buildLoginRedirectPath = (target: string): string => {
  const sanitized = sanitizeInternalRedirect(target);
  if (!sanitized) {
    return "/auth/login";
  }

  return `/auth/login?redirect=${encodeURIComponent(sanitized)}`;
};
