import { setCacheHeaders } from "../../utils/cache";
import { requireTenantContext } from "../../utils/tenant-context";

const slugCache = new Map<string, { available: boolean; ts: number }>();
const CACHE_TTL = 30000;

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const query = getQuery(event);
  const slug = String(query.slug ?? "").trim().toLowerCase();

  if (!slug || slug.length < 4) {
    return { available: false, message: "Minimo 4 caracteres" };
  }

  if (slug.length > 50) {
    return { available: false, message: "Maximo 50 caracteres" };
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { available: false, message: "Solo letras minusculas, numeros y guiones" };
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
