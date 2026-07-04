import { linkPublicBookingClientBySlug } from "../../../../services/public/bookings";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const body = await readBody(event);
  return await linkPublicBookingClientBySlug(event, slug, body);
});
