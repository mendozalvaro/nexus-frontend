import { z } from "zod";
import { verifyWhatsAppCredentials } from "../../services/notifications/whatsapp";

const verifySchema = z.object({
  phoneId: z.string(),
  accessToken: z.string(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, verifySchema.parse);

  const result = await verifyWhatsAppCredentials(body.phoneId, body.accessToken);

  return result;
});
