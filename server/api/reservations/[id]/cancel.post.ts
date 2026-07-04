import {
  requireReservationContextStrict,
  readValidatedReservationBody,
  cancelReservationSchema,
  getReservationOrThrow,
} from "../../../utils/reservations";
import { cancelReservation } from "../../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const reservationId = getRouterParam(event, "id");
  if (!reservationId) throw createError({ statusCode: 400, statusMessage: "ID de reserva requerido." });

  const context = await requireReservationContextStrict(event, "can_delete");
  await getReservationOrThrow(context, reservationId);
  const body = await readValidatedReservationBody(event, cancelReservationSchema);
  await cancelReservation(context, context.userId, reservationId, body.reason);

  return { success: true, reservationId };
});
