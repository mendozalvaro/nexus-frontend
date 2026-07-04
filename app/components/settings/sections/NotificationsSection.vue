<script setup lang="ts">
import type { NotificationType } from "@/types/notifications";

const {
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
  savePreferences,
  saveTemplate,
  verifyCredentials,
  resetTemplate,
} = useNotificationSettings();

const notificationTypes = [
  { key: "sale_receipt", label: "Recibo de venta", icon: "i-lucide-receipt" },
  { key: "appointment_confirmation", label: "Confirmación de cita", icon: "i-lucide-calendar-check" },
  { key: "appointment_reminder", label: "Recordatorio de cita", icon: "i-lucide-bell" },
  { key: "appointment_status_change", label: "Cambio de estado de cita", icon: "i-lucide-circle-alert" },
] as const;

const handleSaveTemplate = (type: NotificationType) => {
  void saveTemplate(type);
};

const lastVerifiedLabel = computed(() => {
  if (!lastVerifiedAt.value) return null;
  return new Date(lastVerifiedAt.value).toLocaleString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const whatsappStatus = computed(() => {
  if (!whatsappForm.value.whatsapp_enabled) return { label: "Desactivado", color: "neutral" as const };
  if (verificationResult.value?.valid) return { label: "Conectado", color: "success" as const };
  if (verificationResult.value?.valid === false) return { label: "Revisar", color: "error" as const };
  return { label: "Pendiente", color: "warning" as const };
});
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <USkeleton v-if="loading" class="h-96" />

    <template v-else>
      <UCard class="rounded-2xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Canales</p>
            <h2 class="text-lg font-semibold">Notificaciones</h2>
            <p class="text-sm text-muted">Configura cómo se envían las notificaciones por canal.</p>
          </div>
        </template>

        <div class="space-y-3 sm:space-y-4">
          <div class="rounded-lg border border-default">
            <button
              type="button"
              class="w-full flex min-h-12 items-center justify-between p-4 text-left"
              @click="emailAccordionOpen = !emailAccordionOpen"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-mail" class="text-lg" />
                <span class="font-medium">Email</span>
                <UBadge color="warning" variant="soft" size="sm">Próximamente</UBadge>
              </div>
              <UIcon :name="emailAccordionOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
            </button>

            <div v-if="emailAccordionOpen" class="space-y-4 border-t border-default px-4 pb-4">
              <div class="pt-4 flex items-center justify-between">
                <div>
                  <h3 class="font-medium">Notificaciones por email</h3>
                  <p class="text-sm text-muted">Recibe alertas de citas, ventas y stock bajo.</p>
                </div>
                <USwitch v-model="emailNotificationsEnabled" />
              </div>

              <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <div class="flex gap-3">
                  <UIcon name="i-lucide-info" class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Próximamente</p>
                    <p class="mt-1 text-sm text-amber-700 dark:text-amber-400">
                      Notificaciones avanzadas por email en una próxima actualización.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-default">
            <button
              type="button"
              class="w-full flex min-h-12 items-center justify-between p-4 text-left"
              @click="whatsappAccordionOpen = !whatsappAccordionOpen"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-simple-icons-whatsapp" class="text-green-500 text-lg" />
                <span class="font-medium">WhatsApp</span>
                <UBadge :color="whatsappStatus.color" variant="soft" size="sm">{{ whatsappStatus.label }}</UBadge>
              </div>
              <UIcon :name="whatsappAccordionOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
            </button>

            <div v-if="whatsappAccordionOpen" class="px-4 pb-4 border-t border-default">
              <div class="pt-4 space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-medium">Habilitar WhatsApp</h3>
                    <p class="text-sm text-muted">Activa el envío de notificaciones por WhatsApp</p>
                  </div>
                  <USwitch v-model="whatsappForm.whatsapp_enabled" />
                </div>

                <div class="grid gap-3 sm:gap-4 md:grid-cols-2">
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
                      placeholder="Token permanente de la API (se mantiene si no lo modificas)"
                      class="flex-1"
                      :disabled="!whatsappForm.whatsapp_enabled"
                      @update:model-value="tokenDirty = true"
                    />
                    <UButton
                      type="button"
                      :icon="showToken ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      variant="soft"
                      @click.prevent="showToken = !showToken"
                    />
                  </div>
                  <p v-if="hasStoredAccessToken && !tokenDirty" class="mt-1 text-xs text-muted">
                    Token guardado. Solo vuelve a pegarlo si deseas reemplazarlo.
                  </p>
                </UFormField>

                <div class="flex flex-col gap-2 rounded-xl border border-default bg-elevated/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <UButton
                    type="button"
                    color="primary"
                    variant="solid"
                    icon="i-lucide-plug-zap"
                    size="md"
                    class="min-h-10 justify-center"
                    :disabled="verifying || !whatsappForm.whatsapp_phone_id || (!whatsappForm.whatsapp_access_token && !(hasStoredAccessToken && !tokenDirty))"
                    @click="verifyCredentials"
                  >
                    {{ verifying ? "Probando..." : "Probar conexión" }}
                  </UButton>

                  <UButton
                    type="button"
                    color="success"
                    variant="solid"
                    icon="i-lucide-save"
                    size="md"
                    class="min-h-10 justify-center"
                    :disabled="saving"
                    @click="savePreferences"
                  >
                    {{ saving ? "Guardando..." : "Guardar configuración" }}
                  </UButton>
                  <p class="text-xs text-muted">
                    Recomendado: probar conexión antes de guardar para validar token y `Phone ID`.
                  </p>
                </div>

                <UAlert
                  v-if="verificationResult"
                  :color="verificationResult.valid ? 'success' : 'error'"
                  :title="verificationResult.valid ? 'Conexión exitosa' : 'Error de conexión'"
                  :description="verificationResult.error"
                />
                <p v-if="lastVerifiedLabel" class="text-xs text-muted">
                  Última verificación exitosa: {{ lastVerifiedLabel }}
                </p>

                <UAlert
                  v-if="settingsFeedback"
                  :color="settingsFeedback.color"
                  :title="settingsFeedback.title"
                  :description="settingsFeedback.description"
                />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <UCard class="rounded-2xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Reglas</p>
            <h2 class="text-lg font-semibold">Tipos de notificación</h2>
          </div>
        </template>

        <div class="space-y-3 sm:space-y-4">
          <div
            v-for="type in notificationTypes"
            :key="type.key"
            class="flex items-center justify-between border-b border-default py-3 last:border-b-0"
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

      <UCard class="rounded-2xl">
        <template #header>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Contenido</p>
            <h2 class="text-lg font-semibold">Templates de mensaje</h2>
          </div>
        </template>

        <div class="space-y-4 sm:space-y-6">
          <div
            v-for="type in notificationTypes"
            :key="type.key"
            class="rounded-xl border border-default bg-elevated/20 p-4"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <UIcon :name="type.icon" class="text-lg" />
                <h3 class="font-medium">{{ type.label }}</h3>
              </div>

              <div class="flex gap-2">
                <UButton
                  type="button"
                  size="sm"
                  variant="soft"
                  :icon="templateEditing[type.key] ? 'i-lucide-x' : 'i-lucide-pencil'"
                  @click.prevent="templateEditing[type.key] = !templateEditing[type.key]"
                >
                  {{ templateEditing[type.key] ? "Cancelar" : "Editar" }}
                </UButton>

                <UButton
                  v-if="templateEditing[type.key]"
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-rotate-ccw"
                  @click.prevent="resetTemplate(type.key)"
                >
                  Restaurar
                </UButton>
              </div>
            </div>

            <template v-if="templateEditing[type.key]">
              <UFormField label="Nombre del template (WhatsApp)">
                <UInput
                  v-model="templateForms[type.key].whatsappTemplateName"
                  placeholder="nombre_del_template"
                />
              </UFormField>

              <UFormField label="Cuerpo del mensaje">
                <UTextarea
                  v-model="templateForms[type.key].templateBody"
                  :rows="6"
                  placeholder="Hola {{name}}, tu cita fue agendada..."
                />
              </UFormField>

              <div class="flex items-center gap-2 mt-2">
                <UButton type="button" size="sm" color="primary" @click.prevent="handleSaveTemplate(type.key)">
                  Guardar template
                </UButton>

                <span class="text-xs text-muted">
                  Variables disponibles:
                  <code v-if="type.key === 'sale_receipt'" v-pre class="px-1 py-0.5 bg-muted rounded">{{name}}, {{branch}}, {{ticket}}, {{total}}, {{payment_method}}</code>
                  <code v-else-if="type.key === 'appointment_confirmation'" v-pre class="px-1 py-0.5 bg-muted rounded">{{name}}, {{service}}, {{date}}, {{time}}, {{employee}}</code>
                  <code v-else-if="type.key === 'appointment_reminder'" v-pre class="px-1 py-0.5 bg-muted rounded">{{name}}, {{minutes}}, {{service}}, {{time}}</code>
                  <code v-else-if="type.key === 'appointment_status_change'" v-pre class="px-1 py-0.5 bg-muted rounded">{{name}}, {{status}}, {{service}}, {{date}}, {{time}}</code>
                </span>
              </div>
            </template>

            <template v-else>
              <div class="bg-muted rounded p-3 font-mono text-sm whitespace-pre-wrap">
                {{ templateForms[type.key]?.templateBody || "Template no configurado" }}
              </div>

              <div class="mt-2 text-xs text-muted">
                Template: <code>{{ templateForms[type.key]?.whatsappTemplateName || "-" }}</code>
              </div>
            </template>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>

