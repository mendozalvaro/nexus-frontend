import {
  requireReservationContextStrict,
  readValidatedReservationBody,
  createPaymentSchema,
} from "../../utils/reservations";
import { registerPayment } from "../../services/reservations/reservations";

export default defineEventHandler(async (event) => {
  const context = await requireReservationContextStrict(event, "can_edit");
  const body = await readValidatedReservationBody(event, createPaymentSchema);
  await registerPayment(context, context.userId, body);
  return { success: true };
});
