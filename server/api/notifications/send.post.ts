import { z } from "zod";
import { sendNotificationWithPreferences } from "../../services/notifications/sender";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { assertNotificationSendAccess } from "../../services/notifications/context";

const sendSchema = z.object({
  notificationType: z.enum(["sale_receipt", "appointment_confirmation", "appointment_reminder", "appointment_status_change"]),
  recipientPhone: z.string().min(8),
  recipientName: z.string().optional(),
  templateVariables: z.record(z.string(), z.string()),
  skipPreferenceCheck: z.boolean().optional().default(false),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, sendSchema.parse);
  const context = await requireStaffTenantContext(event);
  assertNotificationSendAccess(context.role);

  const organizationId = context.organizationId;
  if (!body.skipPreferenceCheck) {
    return await sendNotificationWithPreferences(context.adminClient, organizationId, {
      notificationType: body.notificationType,
      recipientPhone: body.recipientPhone,
      recipientName: body.recipientName,
      templateVariables: body.templateVariables,
    });
  }

  // Si se salta verificacion de preferencias (uso interno/servicio)
  return {
    success: false,
    reason: "preference_check_required",
    message: "Set skipPreferenceCheck=false para usar preferencias de la organizacion",
  };
});
