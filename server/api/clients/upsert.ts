import { upsertClientProfile } from "../../services/clientProfile";
import { requireClientTenantContext } from "../../utils/tenant-context";
import { clientUpsertSchema } from "@/types/client";

export default defineEventHandler(async (event) => {
  const context = await requireClientTenantContext(event);

  const body = await readBody(event);
  const parsed = clientUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const result = await upsertClientProfile(
    event,
    context.userId,
    parsed.data,
    context.organizationId,
  );

  return result;
});
