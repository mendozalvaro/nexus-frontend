<script setup lang="ts">
import type { NotificationRecord } from "@/types/notifications";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "settings.edit",
  roles: ["admin"],
  moduleKey: "settings",
});

const notifications = ref<NotificationRecord[]>([]);
const loading = ref(false);
const page = ref(1);
const limit = ref(20);
const total = ref(0);
const totalPages = ref(0);

const filterType = ref<string>("");
const filterStatus = ref<string>("");

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  failed: "Fallido",
  delivered: "Entregado",
  read: "Leido",
};

const statusColors: Record<string, string> = {
  pending: "neutral",
  sent: "primary",
  failed: "error",
  delivered: "success",
  read: "success",
};

const typeLabels: Record<string, string> = {
  sale_receipt: "Recibo de venta",
  appointment_confirmation: "Confirmacion cita",
  appointment_reminder: "Recordatorio cita",
  appointment_status_change: "Cambio estado",
};

const typeIcons: Record<string, string> = {
  sale_receipt: "i-lucide-receipt",
  appointment_confirmation: "i-lucide-calendar-check",
  appointment_reminder: "i-lucide-bell",
  appointment_status_change: "i-lucide-circle-alert",
};

const loadHistory = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit.value),
    });

    if (filterType.value) {
      params.set("type", filterType.value);
    }

    if (filterStatus.value) {
      params.set("status", filterStatus.value);
    }

    const response = await $fetch<{
      notifications: NotificationRecord[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/notifications/history?${params.toString()}`);

    notifications.value = response.notifications;
    total.value = response.pagination.total;
    totalPages.value = response.pagination.totalPages;
  } catch {
    // Silently handle errors
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

watch([page, filterType, filterStatus], () => {
  page.value = 1;
  loadHistory();
});

onMounted(() => {
  loadHistory();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Historial de notificaciones</h1>
        <p class="text-muted">Registro de todas las notificaciones enviadas por WhatsApp</p>
      </div>

      <UButton
        icon="i-lucide-rotate-ccw"
        variant="soft"
        :loading="loading"
        @click="loadHistory"
      >
        Actualizar
      </UButton>
    </div>

    <!-- Filters -->
    <div class="flex gap-4">
      <USelect
        v-model="filterType"
        placeholder="Tipo de notificacion"
        :items="[
          { label: 'Todos los tipos', value: '' },
          { label: 'Recibo de venta', value: 'sale_receipt' },
          { label: 'Confirmacion cita', value: 'appointment_confirmation' },
          { label: 'Recordatorio cita', value: 'appointment_reminder' },
          { label: 'Cambio estado', value: 'appointment_status_change' },
        ]"
        class="w-48"
      />

      <USelect
        v-model="filterStatus"
        placeholder="Estado"
        :items="[
          { label: 'Todos los estados', value: '' },
          { label: 'Pendiente', value: 'pending' },
          { label: 'Enviado', value: 'sent' },
          { label: 'Fallido', value: 'failed' },
          { label: 'Entregado', value: 'delivered' },
          { label: 'Leido', value: 'read' },
        ]"
        class="w-40"
      />
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-lucide-loader" class="h-8 w-8 animate-spin text-primary mx-auto" />
    </div>

    <div v-else-if="notifications.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-bell-off" class="text-4xl text-muted mb-2" />
      <p class="text-muted">No se encontraron notificaciones</p>
    </div>

    <div v-else class="border rounded-lg overflow-hidden">
      <table class="w-full">
        <thead class="bg-muted">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium">Fecha</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Tipo</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Destinatario</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Estado</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="notif in notifications" :key="notif.id" class="border-t">
            <td class="px-4 py-3 text-sm">{{ formatDate(notif.created_at) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <UIcon :name="typeIcons[notif.notification_type]" class="text-lg" />
                <span class="text-sm">{{ typeLabels[notif.notification_type] ?? notif.notification_type }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <p class="text-sm font-medium">{{ notif.recipient_name ?? "N/A" }}</p>
              <p class="text-xs text-muted">{{ notif.recipient_phone }}</p>
            </td>
            <td class="px-4 py-3">
              <UBadge :color="statusColors[notif.status] ?? 'neutral'" variant="soft">
                {{ statusLabels[notif.status] ?? notif.status }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <span v-if="notif.error_message" class="text-xs text-error" :title="notif.error_message">
                {{ notif.error_message.slice(0, 30) }}...
              </span>
              <span v-else class="text-xs text-muted">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <p class="text-sm text-muted">
        Mostrando {{ ((page - 1) * limit) + 1 }}-{{ Math.min(page * limit, total) }} de {{ total }}
      </p>

      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="limit"
        :sibling-count="1"
      />
    </div>
  </div>
</template>
