import {
  requireReservationContextStrict,
  readValidatedReservationBody,
  createReservationSchema,
} from "../../utils/reservations";
import { createReservation } from "../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const context = await requireReservationContextStrict(event, "can_create");
  const body = await readValidatedReservationBody(event, createReservationSchema);
  const reservationId = await createReservation(context, context.userId, body);
  return { success: true, reservationId };
});
