import type { TenantContext } from "../../utils/tenant-context";

export const assertNotificationAdminAccess = (role: TenantContext["role"]): void => {
  if (role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Admin access required" });
  }
};

export const assertNotificationHistoryAccess = (role: TenantContext["role"]): void => {
  if (!["admin", "manager"].includes(role)) {
    throw createError({ statusCode: 403, statusMessage: "Insufficient permissions" });
  }
};

export const assertNotificationSendAccess = (role: TenantContext["role"]): void => {
  if (!["admin", "manager", "employee"].includes(role)) {
    throw createError({ statusCode: 403, statusMessage: "Insufficient permissions" });
  }
};

export const buildPreferencesPatchPayload = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...body,
    updated_at: new Date().toISOString(),
  };

  if (body.whatsapp_access_token === "") {
    delete payload.whatsapp_access_token;
  }

  return payload;
};

export interface NotificationPreferencesPatchInput {
  whatsapp_enabled?: boolean;
  whatsapp_phone_id?: string | null;
  whatsapp_access_token?: string | null;
  whatsapp_business_account_id?: string | null;
  send_sale_receipt?: boolean;
  send_appointment_confirmation?: boolean;
  send_appointment_reminder?: boolean;
  send_appointment_status_change?: boolean;
  reminder_minutes_before?: number;
}
