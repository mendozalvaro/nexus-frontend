import { getReservationOrThrow, readValidatedReservationBody, requireReservationContextStrict, reservationStayActionSchema } from "../../../utils/reservations";
import { applyReservationStayAction } from "../../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const reservationId = getRouterParam(event, "id");
  if (!reservationId) throw createError({ statusCode: 400, statusMessage: "ID de reserva requerido." });

  const context = await requireReservationContextStrict(event, "can_edit");
  await getReservationOrThrow(context, reservationId);

  const payload = await readValidatedReservationBody(event, reservationStayActionSchema);
  await applyReservationStayAction(context, reservationId, payload);

  return { success: true, reservationId };
});
