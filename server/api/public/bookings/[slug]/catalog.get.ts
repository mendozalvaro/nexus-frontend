import { getPublicBookingCatalogBySlug } from "../../../../services/public/bookings";
import { setCacheHeaders } from "../../../../utils/cache";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const response = await getPublicBookingCatalogBySlug(event, slug);
  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 60, visibility: "public" });
  return response;
});
