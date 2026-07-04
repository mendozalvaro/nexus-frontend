import { z } from "zod";

import { requireStaffTenantContext } from "../../../utils/tenant-context";
import { setOrganizationCustomerStatus } from "../../../services/orgCustomers";

const paramsSchema = z.object({
  clientId: z.string().uuid(),
}).strict();

const bodySchema = z.object({
  status: z.enum(["active", "inactive", "blocked"]),
}).strict();

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const params = paramsSchema.safeParse(getRouterParams(event));
  if (!params.success) {
    throw createError({
      statusCode: 400,
      statusMessage: params.error.issues[0]?.message ?? "Parámetros inválidos.",
    });
  }

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  await setOrganizationCustomerStatus(context, params.data.clientId, parsed.data.status);
  return { success: true };
});
