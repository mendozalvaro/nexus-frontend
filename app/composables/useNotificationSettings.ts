import type { NotificationPreferences, NotificationTemplate, NotificationType } from "@/types/notifications";

type TemplateForm = { whatsappTemplateName: string; templateBody: string };
type FeedbackState = { color: "success" | "error"; title: string; description?: string } | null;

const EMAIL_NOTIFICATIONS_STORAGE_KEY = "nexuspos:settings:notifications";

const notificationTemplateDefaults: Record<NotificationType, { name: string; body: string }> = {
  sale_receipt: {
    name: "recibo_de_venta",
    body: "Hola {{name}}, tu compra en {{branch}} fue exitosa.\n\nTicket: {{ticket}}\nTotal: {{total}}\nMetodo: {{payment_method}}\n\nGracias por tu compra!",
  },
  appointment_confirmation: {
    name: "confirmacion_de_cita",
    body: "Hola {{name}}, tu cita fue agendada exitosamente.\n\nServicio: {{service}}\nFecha: {{date}}\nHora: {{time}}\nEmpleado: {{employee}}\n\nTe esperamos!",
  },
  appointment_reminder: {
    name: "recordatorio_de_cita",
    body: "Hola {{name}}, recordatorio: tienes una cita en {{minutes}} minutos.\n\nServicio: {{service}}\nHora: {{time}}\n\nNos vemos pronto!",
  },
  appointment_status_change: {
    name: "cambio_estado_cita",
    body: "Hola {{name}}, tu cita ha sido {{status}}.\n\nServicio: {{service}}\nFecha: {{date}}\nHora: {{time}}\n\nSi tienes dudas, contactanos.",
  },
};

const notificationTemplateVariables: Record<NotificationType, string[]> = {
  sale_receipt: ["name", "branch", "ticket", "total", "payment_method"],
  appointment_confirmation: ["name", "service", "date", "time", "employee"],
  appointment_reminder: ["name", "minutes", "service", "time"],
  appointment_status_change: ["name", "status", "service", "date", "time"],
};

export const useNotificationSettings = () => {
  const preferences = ref<NotificationPreferences | null>(null);
  const templates = ref<NotificationTemplate[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const verifying = ref(false);
  const verificationResult = ref<{ valid: boolean; error?: string } | null>(null);
  const lastVerifiedAt = ref<string | null>(null);
  const showToken = ref(false);
  const tokenDirty = ref(false);
  const hasStoredAccessToken = ref(false);
  const settingsFeedback = ref<FeedbackState>(null);
  const emailAccordionOpen = ref(false);
  const whatsappAccordionOpen = ref(false);
  const emailNotificationsEnabled = ref(false);

  const whatsappForm = ref({
    whatsapp_enabled: false,
    whatsapp_phone_id: "",
    whatsapp_access_token: "",
    whatsapp_business_account_id: "",
    send_sale_receipt: true,
    send_appointment_confirmation: true,
    send_appointment_reminder: true,
    send_appointment_status_change: true,
    reminder_minutes_before: 60,
  });

  const templateEditing = ref<Record<NotificationType, boolean>>({
    sale_receipt: false,
    appointment_confirmation: false,
    appointment_reminder: false,
    appointment_status_change: false,
  });

  const templateForms = ref<Record<NotificationType, TemplateForm>>({
    sale_receipt: { whatsappTemplateName: "", templateBody: "" },
    appointment_confirmation: { whatsappTemplateName: "", templateBody: "" },
    appointment_reminder: { whatsappTemplateName: "", templateBody: "" },
    appointment_status_change: { whatsappTemplateName: "", templateBody: "" },
  });

  const loadPreferences = async () => {
    loading.value = true;
    settingsFeedback.value = null;
    try {
      const [prefs, temps] = await Promise.all([
        $fetch<NotificationPreferences>("/api/notifications/preferences"),
        $fetch<NotificationTemplate[]>("/api/notifications/templates"),
      ]);

      preferences.value = prefs;
      templates.value = temps;

      whatsappForm.value = {
        whatsapp_enabled: prefs.whatsapp_enabled,
        whatsapp_phone_id: prefs.whatsapp_phone_id ?? "",
        whatsapp_access_token: "",
        whatsapp_business_account_id: prefs.whatsapp_business_account_id ?? "",
        send_sale_receipt: prefs.send_sale_receipt,
        send_appointment_confirmation: prefs.send_appointment_confirmation,
        send_appointment_reminder: prefs.send_appointment_reminder,
        send_appointment_status_change: prefs.send_appointment_status_change,
        reminder_minutes_before: prefs.reminder_minutes_before,
      };
      hasStoredAccessToken.value = Boolean(prefs.has_whatsapp_access_token);
      tokenDirty.value = false;

      for (const template of temps) {
        templateForms.value[template.notification_type] = {
          whatsappTemplateName: template.whatsapp_template_name,
          templateBody: template.template_body,
        };
      }
    } catch (error) {
      settingsFeedback.value = {
        color: "error",
        title: "No pudimos cargar la configuracion",
        description: error instanceof Error ? error.message : "Error desconocido",
      };
    } finally {
      loading.value = false;
    }
  };

  const savePreferences = async () => {
    saving.value = true;
    settingsFeedback.value = null;
    try {
      const payload: Record<string, unknown> = {
        whatsapp_enabled: whatsappForm.value.whatsapp_enabled,
        whatsapp_phone_id: whatsappForm.value.whatsapp_phone_id || null,
        whatsapp_business_account_id: whatsappForm.value.whatsapp_business_account_id || null,
        send_sale_receipt: whatsappForm.value.send_sale_receipt,
        send_appointment_confirmation: whatsappForm.value.send_appointment_confirmation,
        send_appointment_reminder: whatsappForm.value.send_appointment_reminder,
        send_appointment_status_change: whatsappForm.value.send_appointment_status_change,
        reminder_minutes_before: whatsappForm.value.reminder_minutes_before,
      };

      if (tokenDirty.value) {
        payload.whatsapp_access_token = whatsappForm.value.whatsapp_access_token || null;
      }

      await $fetch("/api/notifications/preferences", {
        method: "PATCH",
        body: payload,
      });

      settingsFeedback.value = {
        color: "success",
        title: "Configuración guardada",
      };
      await loadPreferences();
    } catch (error) {
      settingsFeedback.value = {
        color: "error",
        title: "No pudimos guardar la configuracion",
        description: error instanceof Error ? error.message : "Error desconocido",
      };
    } finally {
      saving.value = false;
    }
  };

  const saveTemplate = async (type: NotificationType) => {
    const form = templateForms.value[type];
    if (!form) return;
    const templateName = form.whatsappTemplateName.trim();
    const body = form.templateBody;
    const templateNameRegex = /^[a-z0-9_]+$/;
    if (!templateNameRegex.test(templateName)) {
      settingsFeedback.value = {
        color: "error",
        title: "Nombre de template inválido",
        description: "Usa solo minúsculas, números y guion bajo (ej: mi_template_v1).",
      };
      return;
    }

    const requiredVariables = notificationTemplateVariables[type];
    const missingVariables = requiredVariables.filter((variable) => !body.includes(`{{${variable}}}`));
    if (missingVariables.length > 0) {
      settingsFeedback.value = {
        color: "error",
        title: "Faltan variables en el template",
        description: `Incluye: ${missingVariables.map((v) => `{{${v}}}`).join(", ")}`,
      };
      return;
    }

    try {
      await $fetch("/api/notifications/templates", {
        method: "PATCH",
        body: {
          notificationType: type,
          whatsappTemplateName: templateName,
          templateBody: body,
        },
      });

      templateEditing.value[type] = false;
      settingsFeedback.value = {
        color: "success",
        title: "Template guardado",
      };
      await loadPreferences();
    } catch (error) {
      settingsFeedback.value = {
        color: "error",
        title: "No pudimos guardar el template",
        description: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  };

  const verifyCredentials = async () => {
    const canUseStoredToken = hasStoredAccessToken.value && !tokenDirty.value;
    if (!whatsappForm.value.whatsapp_phone_id || (!whatsappForm.value.whatsapp_access_token && !canUseStoredToken)) {
      verificationResult.value = { valid: false, error: "Ingresa Phone ID y Access Token" };
      return;
    }

    verifying.value = true;
    try {
      const result = await $fetch<{ valid: boolean; error?: string }>("/api/notifications/verify", {
        method: "POST",
        body: {
          phoneId: whatsappForm.value.whatsapp_phone_id,
          accessToken: tokenDirty.value ? whatsappForm.value.whatsapp_access_token : undefined,
        },
      });

      verificationResult.value = result;
      if (result.valid) {
        lastVerifiedAt.value = new Date().toISOString();
      }
    } catch {
      verificationResult.value = { valid: false, error: "Error de conexión" };
    } finally {
      verifying.value = false;
    }
  };

  const resetTemplate = (type: NotificationType) => {
    const def = notificationTemplateDefaults[type];
    templateForms.value[type] = {
      whatsappTemplateName: def.name,
      templateBody: def.body,
    };
  };

  onMounted(() => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem(EMAIL_NOTIFICATIONS_STORAGE_KEY);
        emailNotificationsEnabled.value = stored !== null ? JSON.parse(stored) : false;
      } catch {
        emailNotificationsEnabled.value = false;
      }
    }
    loadPreferences();
  });

  watch(emailNotificationsEnabled, (val) => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(EMAIL_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(val));
    } catch {
      // Storage disabled/full
    }
  });

  return {
    preferences,
    templates,
    loading,
    saving,
    verifying,
    verificationResult,
    lastVerifiedAt,
    showToken,
    tokenDirty,
    hasStoredAccessToken,
    settingsFeedback,
    emailAccordionOpen,
    whatsappAccordionOpen,
    emailNotificationsEnabled,
    whatsappForm,
    templateEditing,
    templateForms,
    loadPreferences,
    savePreferences,
    saveTemplate,
    verifyCredentials,
    resetTemplate,
  };
};
