import { requireReservationContextStrict } from "../../utils/reservations";
import { getReservationRoomBoard } from "../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const context = await requireReservationContextStrict(event, "can_view");
  const query = getQuery(event);

  return await getReservationRoomBoard(context, query.branchId as string | undefined);
});
