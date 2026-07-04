import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";
import { getPaymentValidationDetail } from "../../../services/system/payment-validations";

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "billing_reviews", "can_view");

  const validationId = getRouterParam(event, "validationId");
  if (!validationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "ValidationId requerido.",
    });
  }

  const result = await getPaymentValidationDetail(context.adminClient, validationId);
  return result;
});
