import { requireReservationContextStrict, getReservationOrThrow } from "../../utils/reservations";
import { getReservationDetail } from "../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const reservationId = getRouterParam(event, "id");
  if (!reservationId) throw createError({ statusCode: 400, statusMessage: "ID de reserva requerido." });

  const context = await requireReservationContextStrict(event, "can_view");
  await getReservationOrThrow(context, reservationId);
  return await getReservationDetail(context, reservationId);
});
