import { createPublicBookingBySlug } from "../../../services/public/bookings";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const body = await readBody(event);
  return await createPublicBookingBySlug(event, slug, body);
});
