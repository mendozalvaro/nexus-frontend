import { setCacheHeaders } from "../../../utils/cache";
import { getPublicCatalogBySlug } from "../../../services/public/catalog";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const catalog = await getPublicCatalogBySlug(event, slug);
  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 120, visibility: "public" });
  return catalog;
});
