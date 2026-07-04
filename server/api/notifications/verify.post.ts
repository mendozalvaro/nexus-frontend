import { z } from "zod";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { assertNotificationAdminAccess } from "../../services/notifications/context";
import { verifyNotificationCredentials } from "../../services/notifications/admin";

const verifySchema = z.object({
  phoneId: z.string(),
  accessToken: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  assertNotificationAdminAccess(context.role);

  const body = await readValidatedBody(event, verifySchema.parse);
  return await verifyNotificationCredentials(context, body);
});
