import { requireReservationContextStrict, getReservationOrThrow } from "../../../utils/reservations";
import { applyReservationStayAction } from "../../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const reservationId = getRouterParam(event, "id");
  if (!reservationId) throw createError({ statusCode: 400, statusMessage: "ID de reserva requerido." });

  const context = await requireReservationContextStrict(event, "can_edit");
  await getReservationOrThrow(context, reservationId);
  await applyReservationStayAction(context, reservationId, { action: "check_out" });

  return { success: true, reservationId };
});
