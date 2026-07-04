import { setCacheHeaders } from "../../../utils/cache";
import { getPublicStorefrontBySlug } from "../../../services/public/storefront";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const storefront = await getPublicStorefrontBySlug(event, slug);
  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 120, visibility: "public" });
  return storefront;
});
