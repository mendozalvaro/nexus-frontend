import { setCacheHeaders } from "../../utils/cache";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { getOrganizationSlugValidationError, normalizeOrganizationSlug } from "../../utils/organization-slug";

const slugCache = new Map<string, { available: boolean; ts: number }>();
const CACHE_TTL = 30000;

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  const query = getQuery(event);
  const slug = normalizeOrganizationSlug(String(query.slug ?? ""));
  const slugError = getOrganizationSlugValidationError(slug);

  if (slugError) {
    return { available: false, message: slugError };
  }

  const cached = slugCache.get(slug);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { available: cached.available, message: cached.available ? "Disponible" : "No disponible" };
  }

  const { data, error } = await context.adminClient
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .neq("id", context.organizationId)
    .maybeSingle();

  const available = !data;

  slugCache.set(slug, { available, ts: Date.now() });

  if (error) {
    return { available: true, message: "No se pudo verificar" };
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return {
    available,
    message: available ? "Disponible" : "Este slug ya esta en uso",
  };
});
