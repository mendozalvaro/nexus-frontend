import { createError } from "h3";

import type {
  NotificationPreferences,
  NotificationStatus,
  NotificationType,
} from "@/types/notifications";
import type { TenantContext } from "../../utils/tenant-context";
import {
  buildPreferencesPatchPayload,
  type NotificationPreferencesPatchInput,
} from "./context";
import {
  getNotificationPreferences,
  verifyWhatsAppCredentials,
} from "./whatsapp";

const DEFAULT_NOTIFICATION_PREFERENCES = {
  whatsapp_enabled: false,
  send_sale_receipt: true,
  send_appointment_confirmation: true,
  send_appointment_reminder: true,
  send_appointment_status_change: true,
  reminder_minutes_before: 60,
} as const;

const sanitizePreferencesResponse = (
  prefs: NotificationPreferences,
) => {
  const { whatsapp_access_token, ...safePrefs } = prefs;
  return {
    ...safePrefs,
    has_whatsapp_access_token: Boolean(whatsapp_access_token),
  };
};

export const getOrCreateNotificationPreferences = async (
  context: TenantContext,
) => {
  const supabase = context.adminClient as any;
  const existing = await getNotificationPreferences(context.adminClient, context.organizationId);
  if (existing) {
    return sanitizePreferencesResponse(existing);
  }

  const { data: created, error } = await supabase
    .from("notification_preferences")
    .insert({
      organization_id: context.organizationId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    })
    .select()
    .single();

  if (error || !created) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "Failed to create preferences",
    });
  }

  return sanitizePreferencesResponse(created);
};

export const updateNotificationPreferences = async (
  context: TenantContext,
  body: NotificationPreferencesPatchInput,
) => {
  const supabase = context.adminClient as any;
  const updatePayload = buildPreferencesPatchPayload(body as Record<string, unknown>);
  const existing = await getNotificationPreferences(context.adminClient, context.organizationId);

  const builder = existing
    ? supabase
      .from("notification_preferences")
      .update(updatePayload)
      .eq("organization_id", context.organizationId)
    : supabase
      .from("notification_preferences")
      .insert({
        organization_id: context.organizationId,
        ...updatePayload,
      });

  const { data, error } = await builder
    .select()
    .single();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: existing ? "Failed to update preferences" : "Failed to create preferences",
    });
  }

  return sanitizePreferencesResponse(data);
};

export const listNotificationHistory = async (
  context: TenantContext,
  query: {
    page: number;
    limit: number;
    type?: NotificationType;
    status?: NotificationStatus;
  },
) => {
  const supabase = context.adminClient as any;
  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  let queryBuilder = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.type) {
    queryBuilder = queryBuilder.eq("notification_type", query.type);
  }

  if (query.status) {
    queryBuilder = queryBuilder.eq("status", query.status);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "Failed to fetch notification history" });
  }

  return {
    notifications: data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / query.limit),
    },
  };
};

export const listNotificationTemplates = async (
  context: TenantContext,
) => {
  const supabase = context.adminClient as any;
  const { data, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("notification_type");

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "Failed to fetch templates" });
  }

  return data;
};

export const upsertNotificationTemplate = async (
  context: TenantContext,
  body: {
    notificationType: NotificationType;
    whatsappTemplateName: string;
    templateBody: string;
    isActive?: boolean;
  },
) => {
  const supabase = context.adminClient as any;
  const { data: existing, error: existingError } = await supabase
    .from("notification_templates")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("notification_type", body.notificationType)
    .maybeSingle();

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: "Failed to inspect existing template" });
  }

  const builder = existing?.id
    ? supabase
      .from("notification_templates")
      .update({
        whatsapp_template_name: body.whatsappTemplateName,
        template_body: body.templateBody,
        is_active: body.isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
    : supabase
      .from("notification_templates")
      .insert({
        organization_id: context.organizationId,
        notification_type: body.notificationType,
        whatsapp_template_name: body.whatsappTemplateName,
        template_body: body.templateBody,
        is_active: body.isActive ?? true,
      });

  const { data, error } = await builder
    .select()
    .single();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: existing?.id ? "Failed to update template" : "Failed to create template",
    });
  }

  return data;
};

export const verifyNotificationCredentials = async (
  context: TenantContext,
  body: {
    phoneId: string;
    accessToken?: string;
  },
) => {
  let accessToken = body.accessToken?.trim();
  if (!accessToken) {
    const prefs = await getNotificationPreferences(context.adminClient, context.organizationId);
    accessToken = prefs?.whatsapp_access_token ?? "";
  }

  if (!accessToken) {
    throw createError({
      statusCode: 400,
      statusMessage: "Access Token no configurado",
    });
  }

  return await verifyWhatsAppCredentials(body.phoneId, accessToken);
};
