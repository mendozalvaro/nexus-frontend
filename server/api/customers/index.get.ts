import { z } from "zod";

import { requireStaffTenantContext } from "../../utils/tenant-context";
import { listOrganizationCustomers } from "../../services/orgCustomers";

const querySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
  includeAnonymous: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Query inválida.",
    });
  }

  const result = await listOrganizationCustomers(context, {
    query: parsed.data.q,
    status: parsed.data.status,
    includeAnonymous: parsed.data.includeAnonymous,
    page: parsed.data.page,
    perPage: parsed.data.perPage,
  });

  return result;
});
