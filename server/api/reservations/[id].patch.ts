import {
  requireReservationContextStrict,
  readValidatedReservationBody,
  updateReservationSchema,
} from "../../utils/reservations";
import { updateReservation } from "../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const reservationId = getRouterParam(event, "id");
  if (!reservationId) throw createError({ statusCode: 400, statusMessage: "ID de reserva requerido." });

  const context = await requireReservationContextStrict(event, "can_edit");
  const body = await readValidatedReservationBody(event, updateReservationSchema);
  await updateReservation(context, reservationId, body);

  return { success: true, reservationId };
});
