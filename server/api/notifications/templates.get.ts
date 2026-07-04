import { requireStaffTenantContext } from "../../utils/tenant-context";
import { assertNotificationAdminAccess } from "../../services/notifications/context";
import { listNotificationTemplates } from "../../services/notifications/admin";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  assertNotificationAdminAccess(context.role);
  return await listNotificationTemplates(context);
});
