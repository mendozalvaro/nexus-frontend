import { getOrCreateNotificationPreferences } from "../../services/notifications/admin";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { assertNotificationAdminAccess } from "../../services/notifications/context";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  assertNotificationAdminAccess(context.role);
  return await getOrCreateNotificationPreferences(context);
});
