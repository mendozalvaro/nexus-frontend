import { getPublicBookingAvailabilityBySlug } from "../../../../services/public/bookings";
import { setCacheHeaders } from "../../../../utils/cache";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const query = getQuery(event);
  const response = await getPublicBookingAvailabilityBySlug(event, slug, {
    branchId: typeof query.branchId === "string" ? query.branchId : "",
    serviceId: typeof query.serviceId === "string" ? query.serviceId : "",
    employeeId: typeof query.employeeId === "string" ? query.employeeId : "",
    date: typeof query.date === "string" ? query.date : "",
  });
  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "public" });
  return response;
});
