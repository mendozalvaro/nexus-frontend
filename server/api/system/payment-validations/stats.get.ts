import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";
import { getPaymentValidationStats } from "../../../services/system/payment-validations";

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "billing_reviews", "can_view");

  const stats = await getPaymentValidationStats(context.adminClient);
  return { stats };
});
