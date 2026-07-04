import { z } from "zod";

import {
  assertSystemModuleAccess,
  parsePagination,
  requireSystemAdminContext,
} from "../../../utils/system-admin";
import { listPaymentValidations } from "../../../services/system/payment-validations";

const querySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "pending", "approved", "rejected"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "billing_reviews", "can_view");

  const query = getQuery(event);
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Query invalida.",
    });
  }

  const { page, perPage } = parsePagination(event, 20);
  const result = await listPaymentValidations(context.adminClient, {
    search: parsed.data.search,
    status: parsed.data.status,
    dateFrom: parsed.data.dateFrom,
    dateTo: parsed.data.dateTo,
    page,
    perPage,
  });

  return {
    page,
    perPage,
    total: result.total,
    rows: result.rows,
  };
});
