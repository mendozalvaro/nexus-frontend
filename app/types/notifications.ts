export type NotificationType = 'sale_receipt' | 'appointment_confirmation' | 'appointment_reminder' | 'appointment_status_change';
export type NotificationChannel = 'whatsapp';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'read';

export interface NotificationTemplate {
  id: string;
  organization_id: string;
  notification_type: NotificationType;
  whatsapp_template_name: string;
  template_body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  organization_id: string;
  whatsapp_enabled: boolean;
  whatsapp_phone_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_business_account_id: string | null;
  send_sale_receipt: boolean;
  send_appointment_confirmation: boolean;
  send_appointment_reminder: boolean;
  send_appointment_status_change: boolean;
  reminder_minutes_before: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  organization_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  recipient_phone: string;
  recipient_name: string | null;
  template_id: string | null;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  whatsapp_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
}

export interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status: string;
  }>;
}

export interface WhatsAppErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_data: {
      messaging_product: string;
      details: string;
    };
  };
}
