import { z } from "zod";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import {
  assertNotificationAdminAccess,
} from "../../services/notifications/context";
import { updateNotificationPreferences } from "../../services/notifications/admin";

const updateSchema = z.object({
  whatsapp_enabled: z.boolean().optional(),
  whatsapp_phone_id: z.string().nullable().optional(),
  whatsapp_access_token: z.string().nullable().optional(),
  whatsapp_business_account_id: z.string().nullable().optional(),
  send_sale_receipt: z.boolean().optional(),
  send_appointment_confirmation: z.boolean().optional(),
  send_appointment_reminder: z.boolean().optional(),
  send_appointment_status_change: z.boolean().optional(),
  reminder_minutes_before: z.number().int().min(5).max(1440).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, updateSchema.parse);
  const context = await requireStaffTenantContext(event);
  assertNotificationAdminAccess(context.role);
  return await updateNotificationPreferences(context, body);
});
