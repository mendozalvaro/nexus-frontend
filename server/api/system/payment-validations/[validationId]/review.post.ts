import { z } from "zod";

import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../../utils/system-admin";
import { reviewPaymentValidation } from "../../../../services/system/payment-validations";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(1).max(500).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "billing_reviews", "can_approve");

  const validationId = getRouterParam(event, "validationId");
  if (!validationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "ValidationId requerido.",
    });
  }

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  return await reviewPaymentValidation(context.adminClient, {
    validationId,
    decision: parsed.data.decision,
    reason: parsed.data.reason ?? null,
  });
});
