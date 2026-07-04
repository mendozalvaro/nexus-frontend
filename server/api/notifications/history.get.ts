import { z } from "zod";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { assertNotificationHistoryAccess } from "../../services/notifications/context";
import { listNotificationHistory } from "../../services/notifications/admin";

const historySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["sale_receipt", "appointment_confirmation", "appointment_reminder", "appointment_status_change"]).optional(),
  status: z.enum(["pending", "sent", "failed", "delivered", "read"]).optional(),
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, historySchema.parse);
  const context = await requireStaffTenantContext(event);
  assertNotificationHistoryAccess(context.role);
  return await listNotificationHistory(context, query);
});
