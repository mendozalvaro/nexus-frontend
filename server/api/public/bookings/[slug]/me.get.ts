import { getPublicBookingClientProfileBySlug } from "../../../../services/public/bookings";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  return await getPublicBookingClientProfileBySlug(event, slug);
});
