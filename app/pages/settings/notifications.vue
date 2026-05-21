<script setup lang="ts">
import type { NotificationPreferences, NotificationTemplate } from "@/types/notifications";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "settings.manage",
  roles: ["admin"],
});

const preferences = ref<NotificationPreferences | null>(null);
const templates = ref<NotificationTemplate[]>([]);
const loading = ref(false);
const saving = ref(false);
const verifying = ref(false);
const verificationResult = ref<{ valid: boolean; error?: string } | null>(null);
const showToken = ref(false);

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

const templateEditing = ref<Record<string, boolean>>({
  sale_receipt: false,
  appointment_confirmation: false,
  appointment_reminder: false,
  appointment_status_change: false,
});

const templateForms = ref<Record<string, { whatsappTemplateName: string; templateBody: string }>>({});

const notificationTypes = [
  { key: "sale_receipt", label: "Recibo de venta", icon: "i-lucide-receipt" },
  { key: "appointment_confirmation", label: "Confirmacion de cita", icon: "i-lucide-calendar-check" },
  { key: "appointment_reminder", label: "Recordatorio de cita", icon: "i-lucide-bell" },
  { key: "appointment_status_change", label: "Cambio de estado de cita", icon: "i-lucide-circle-alert" },
] as const;

const loadPreferences = async () => {
  loading.value = true;
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
      whatsapp_access_token: prefs.whatsapp_access_token ?? "",
      whatsapp_business_account_id: prefs.whatsapp_business_account_id ?? "",
      send_sale_receipt: prefs.send_sale_receipt,
      send_appointment_confirmation: prefs.send_appointment_confirmation,
      send_appointment_reminder: prefs.send_appointment_reminder,
      send_appointment_status_change: prefs.send_appointment_status_change,
      reminder_minutes_before: prefs.reminder_minutes_before,
    };

    for (const template of temps) {
      templateForms.value[template.notification_type] = {
        whatsappTemplateName: template.whatsapp_template_name,
        templateBody: template.template_body,
      };
    }
  } catch {
    // Silently handle errors
  } finally {
    loading.value = false;
  }
};

const savePreferences = async () => {
  saving.value = true;
  try {
    await $fetch("/api/notifications/preferences", {
      method: "PATCH",
      body: {
        whatsapp_enabled: whatsappForm.value.whatsapp_enabled,
        whatsapp_phone_id: whatsappForm.value.whatsapp_phone_id || null,
        whatsapp_access_token: whatsappForm.value.whatsapp_access_token || null,
        whatsapp_business_account_id: whatsappForm.value.whatsapp_business_account_id || null,
        send_sale_receipt: whatsappForm.value.send_sale_receipt,
        send_appointment_confirmation: whatsappForm.value.send_appointment_confirmation,
        send_appointment_reminder: whatsappForm.value.send_appointment_reminder,
        send_appointment_status_change: whatsappForm.value.send_appointment_status_change,
        reminder_minutes_before: whatsappForm.value.reminder_minutes_before,
      },
    });

    await loadPreferences();
  } catch {
    // Silently handle errors
  } finally {
    saving.value = false;
  }
};

const saveTemplate = async (type: string) => {
  const form = templateForms.value[type];
  if (!form) return;

  try {
    await $fetch("/api/notifications/templates", {
      method: "PATCH",
      body: {
        notificationType: type,
        whatsappTemplateName: form.whatsappTemplateName,
        templateBody: form.templateBody,
      },
    });

    templateEditing.value[type] = false;
    await loadPreferences();
  } catch {
    // Silently handle errors
  }
};

const verifyCredentials = async () => {
  if (!whatsappForm.value.whatsapp_phone_id || !whatsappForm.value.whatsapp_access_token) {
    verificationResult.value = { valid: false, error: "Ingresa Phone ID y Access Token" };
    return;
  }

  verifying.value = true;
  try {
    const result = await $fetch<{ valid: boolean; error?: string }>("/api/notifications/verify", {
      method: "POST",
      body: {
        phoneId: whatsappForm.value.whatsapp_phone_id,
        accessToken: whatsappForm.value.whatsapp_access_token,
      },
    });

    verificationResult.value = result;
  } catch {
    verificationResult.value = { valid: false, error: "Error de conexion" };
  } finally {
    verifying.value = false;
  }
};

const resetTemplate = async (type: string) => {
  const defaults: Record<string, { name: string; body: string }> = {
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

  const def = defaults[type];
  if (def) {
    templateForms.value[type] = {
      whatsappTemplateName: def.name,
      templateBody: def.body,
    };
  }
};

onMounted(() => {
  loadPreferences();
});
</script>

<template>
  <div class="space-y-6">
    <UiModuleHero
      eyebrow="Configuracion"
      title="Notificaciones"
      description="Configura WhatsApp para enviar recibos de venta y recordatorios de citas automaticamente."
      icon="i-lucide-bell-ring"
    />

    <USkeleton v-if="loading" class="h-96" />

    <template v-else>
      <!-- WhatsApp Configuration -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-simple-icons-whatsapp" class="text-green-500 text-xl" />
            <h2 class="text-lg font-semibold">WhatsApp Cloud API</h2>
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium">Habilitar WhatsApp</h3>
              <p class="text-sm text-muted">Activa el envio de notificaciones por WhatsApp</p>
            </div>
            <USwitch v-model="whatsappForm.whatsapp_enabled" />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Phone ID">
              <UInput
                v-model="whatsappForm.whatsapp_phone_id"
                placeholder="Tu Phone ID de Meta"
                :disabled="!whatsappForm.whatsapp_enabled"
              />
            </UFormField>

            <UFormField label="Business Account ID">
              <UInput
                v-model="whatsappForm.whatsapp_business_account_id"
                placeholder="ID de cuenta de negocio"
                :disabled="!whatsappForm.whatsapp_enabled"
              />
            </UFormField>
          </div>

          <UFormField label="Access Token">
            <div class="flex gap-2">
              <UInput
                v-model="whatsappForm.whatsapp_access_token"
                :type="showToken ? 'text' : 'password'"
                placeholder="Token permanente de la API"
                class="flex-1"
                :disabled="!whatsappForm.whatsapp_enabled"
              />
              <UButton
                :icon="showToken ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                variant="soft"
                @click="showToken = !showToken"
              />
            </div>
          </UFormField>

          <div class="flex items-center gap-2">
            <UButton
              color="primary"
              :loading="verifying"
              :disabled="!whatsappForm.whatsapp_phone_id || !whatsappForm.whatsapp_access_token"
              @click="verifyCredentials"
            >
              Probar conexion
            </UButton>

            <UButton color="success" :loading="saving" @click="savePreferences">
              Guardar configuracion
            </UButton>
          </div>

          <UAlert
            v-if="verificationResult"
            :color="verificationResult.valid ? 'success' : 'error'"
            :title="verificationResult.valid ? 'Conexion exitosa' : 'Error de conexion'"
            :description="verificationResult.error"
          />
        </div>
      </UCard>

      <!-- Notification Types -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Tipos de notificacion</h2>
        </template>

        <div class="space-y-4">
          <div
            v-for="type in notificationTypes"
            :key="type.key"
            class="flex items-center justify-between py-3 border-b last:border-b-0"
          >
            <div class="flex items-center gap-3">
              <UIcon :name="type.icon" class="text-lg" />
              <div>
                <p class="font-medium">{{ type.label }}</p>
              </div>
            </div>

            <USwitch
              :model-value="whatsappForm[`send_${type.key}` as keyof typeof whatsappForm] as boolean"
              @update:model-value="(val: boolean) => { whatsappForm[`send_${type.key}` as keyof typeof whatsappForm] = val as never; }"
            />
          </div>

          <UFormField label="Minutos antes del recordatorio">
            <UInputNumber
              v-model="whatsappForm.reminder_minutes_before"
              :min="5"
              :max="1440"
              class="w-32"
            />
            <p class="text-xs text-muted mt-1">
              {{ whatsappForm.reminder_minutes_before }} minutos ({{ Math.floor(whatsappForm.reminder_minutes_before / 60) }}h {{ whatsappForm.reminder_minutes_before % 60 }}min)
            </p>
          </UFormField>
        </div>
      </UCard>

      <!-- Templates -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Templates de mensaje</h2>
        </template>

        <div class="space-y-6">
          <div
            v-for="type in notificationTypes"
            :key="type.key"
            class="border rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <UIcon :name="type.icon" class="text-lg" />
                <h3 class="font-medium">{{ type.label }}</h3>
              </div>

              <div class="flex gap-2">
                <UButton
                  size="sm"
                  variant="soft"
                  :icon="templateEditing[type.key] ? 'i-lucide-x' : 'i-lucide-pencil'"
                  @click="templateEditing[type.key] = !templateEditing[type.key]"
                >
                  {{ templateEditing[type.key] ? "Cancelar" : "Editar" }}
                </UButton>

                <UButton
                  v-if="templateEditing[type.key]"
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-rotate-ccw"
                  @click="resetTemplate(type.key)"
                >
                  Restaurar
                </UButton>
              </div>
            </div>

            <template v-if="templateEditing[type.key]">
              <UFormField label="Nombre del template (WhatsApp)">
                <UInput
                  v-if="templateForms[type.key]"
                  v-model="(templateForms[type.key] as { whatsappTemplateName: string; templateBody: string }).whatsappTemplateName"
                  placeholder="nombre_del_template"
                />
              </UFormField>

              <UFormField label="Cuerpo del mensaje">
                <UTextarea
                  v-if="templateForms[type.key]"
                  v-model="(templateForms[type.key] as { whatsappTemplateName: string; templateBody: string }).templateBody"
                  :rows="6"
                  placeholder="Hola {{name}}, tu cita fue agendada..."
                />
              </UFormField>

              <div class="flex items-center gap-2 mt-2">
                <UButton size="sm" color="primary" @click="saveTemplate(type.key)">
                  Guardar template
                </UButton>

                <span class="text-xs text-muted">
                  Variables disponibles:
                  <code v-if="type.key === 'sale_receipt'" class="px-1 py-0.5 bg-muted rounded">{{ "{{name}}" }}, {{ "{{branch}}" }}, {{ "{{ticket}}" }}, {{ "{{total}}" }}, {{ "{{payment_method}}" }}</code>
                  <code v-else-if="type.key === 'appointment_confirmation'" class="px-1 py-0.5 bg-muted rounded">{{ "{{name}}" }}, {{ "{{service}}" }}, {{ "{{date}}" }}, {{ "{{time}}" }}, {{ "{{employee}}" }}</code>
                  <code v-else-if="type.key === 'appointment_reminder'" class="px-1 py-0.5 bg-muted rounded">{{ "{{name}}" }}, {{ "{{minutes}}" }}, {{ "{{service}}" }}, {{ "{{time}}" }}</code>
                  <code v-else-if="type.key === 'appointment_status_change'" class="px-1 py-0.5 bg-muted rounded">{{ "{{name}}" }}, {{ "{{status}}" }}, {{ "{{service}}" }}, {{ "{{date}}" }}, {{ "{{time}}" }}</code>
                </span>
              </div>
            </template>

            <template v-else>
              <div class="bg-muted rounded p-3 font-mono text-sm whitespace-pre-wrap">
                {{ templateForms[type.key] ? (templateForms[type.key] as { whatsappTemplateName: string; templateBody: string }).templateBody : "Template no configurado" }}
              </div>

              <div class="mt-2 text-xs text-muted">
                Template: <code>{{ templateForms[type.key] ? (templateForms[type.key] as { whatsappTemplateName: string; templateBody: string }).whatsappTemplateName : "-" }}</code>
              </div>
            </template>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
