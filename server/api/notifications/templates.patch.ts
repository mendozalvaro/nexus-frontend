import { z } from "zod";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { assertNotificationAdminAccess } from "../../services/notifications/context";
import { upsertNotificationTemplate } from "../../services/notifications/admin";

const updateTemplateSchema = z.object({
  notificationType: z.enum(["sale_receipt", "appointment_confirmation", "appointment_reminder", "appointment_status_change"]),
  whatsappTemplateName: z.string().min(1).max(512),
  templateBody: z.string().min(1).max(1024),
  isActive: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, updateTemplateSchema.parse);
  const context = await requireStaffTenantContext(event);
  assertNotificationAdminAccess(context.role);
  return await upsertNotificationTemplate(context, body);
});
