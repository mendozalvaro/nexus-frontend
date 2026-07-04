import { z } from "zod";

import { requireStaffTenantContext } from "../../utils/tenant-context";
import { mergeOrganizationCustomers } from "../../services/orgCustomers";

const bodySchema = z.object({
  targetClientId: z.string().uuid(),
  sourceClientId: z.string().uuid(),
}).strict();

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  await mergeOrganizationCustomers(context, parsed.data.targetClientId, parsed.data.sourceClientId);
  return { success: true };
});
