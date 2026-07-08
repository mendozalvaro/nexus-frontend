import { z } from "zod";

import { requireReservationContextStrict, readValidatedReservationBody } from "../../utils/reservations";
import { lookupGuestByDocument } from "../../services/reservations/reservations";

const bodySchema = z.object({
  documentNumber: z.string().trim().min(1),
  documentType: z.string().trim().optional(),
}).strict();

export default defineEventHandler(async (event) => {
  const context = await requireReservationContextStrict(event, "can_create");
  const body = await readValidatedReservationBody(event, bodySchema);

  return await lookupGuestByDocument(
    context,
    body.documentNumber,
    body.documentType,
  );
});
