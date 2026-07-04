import { requireReservationContextStrict } from "../../utils/reservations";
import { getReservationsList } from "../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const context = await requireReservationContextStrict(event, "can_view");
  const query = getQuery(event);

  const filters = {
    branchId: query.branchId as string | undefined,
    status: query.status as string | undefined,
    search: query.search as string | undefined,
    fromDate: query.fromDate as string | undefined,
    toDate: query.toDate as string | undefined,
    page: query.page ? Number(query.page) : 1,
    perPage: query.perPage ? Number(query.perPage) : 20,
  };

  return await getReservationsList(context, filters);
});
