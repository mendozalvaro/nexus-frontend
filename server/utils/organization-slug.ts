const RESERVED_ORGANIZATION_SLUGS = new Set([
  "",
  "admin",
  "api",
  "auth",
  "catalog",
  "catalogo",
  "clientes",
  "customers",
  "dashboard",
  "hotel",
  "index",
  "inventory",
  "landing",
  "notifications",
  "onboarding",
  "pos",
  "privacy",
  "reports",
  "settings",
  "system",
  "terms",
  "users",
]);

export const normalizeOrganizationSlug = (value: string) => value.trim().toLowerCase();

export const getOrganizationSlugValidationError = (value: string): string | null => {
  const slug = normalizeOrganizationSlug(value);

  if (!slug || slug.length < 4) {
    return "Minimo 4 caracteres";
  }

  if (slug.length > 50) {
    return "Maximo 50 caracteres";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Solo letras minusculas, numeros y guiones";
  }

  if (RESERVED_ORGANIZATION_SLUGS.has(slug)) {
    return "Este slug esta reservado por el sistema";
  }

  return null;
};
