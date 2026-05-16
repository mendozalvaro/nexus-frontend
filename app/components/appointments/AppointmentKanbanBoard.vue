<script setup lang="ts">
import type { AppointmentListItem } from "@/composables/useAppointments";

const props = defineProps<{
  appointments: AppointmentListItem[];
  loading: boolean;
  canMutateStatuses: boolean;
  mutationLoading: boolean;
}>();

const emits = defineEmits<{
  edit: [AppointmentListItem];
  cancel: [AppointmentListItem];
  "toggle-status": [AppointmentListItem, "in_progress" | "completed"];
  "no-show": [AppointmentListItem];
  create: [];
  checkout: [AppointmentListItem];
  "view-receipt": [AppointmentListItem];
}>();

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: string[];
}

const columns: KanbanColumn[] = [
  {
    id: "pending",
    title: "Pendiente",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    statuses: ["pending"],
  },
  {
    id: "confirmed",
    title: "Confirmada",
    color: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
    borderColor: "border-sky-200 dark:border-sky-800",
    statuses: ["confirmed"],
  },
  {
    id: "in_progress",
    title: "En proceso",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    statuses: ["in_progress"],
  },
  {
    id: "completed",
    title: "Completada",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    statuses: ["completed"],
  },
  {
    id: "closed",
    title: "Cerrada",
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-50 dark:bg-slate-900/30",
    borderColor: "border-slate-200 dark:border-slate-700",
    statuses: ["cancelled", "no_show"],
  },
];

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const groupedAppointments = computed(() => {
  const groups: Record<string, AppointmentListItem[]> = {};
  for (const col of columns) {
    groups[col.id] = props.appointments.filter((apt) => col.statuses.includes(apt.status));
  }
  return groups;
});

const statusLabel = (status: string): string => {
  const map: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    in_progress: "En proceso",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No asistio",
  };
  return map[status] ?? status;
};

const statusBadgeColor = (status: string): string => {
  const map: Record<string, string> = {
    pending: "amber",
    confirmed: "sky",
    in_progress: "orange",
    completed: "emerald",
    cancelled: "neutral",
    no_show: "neutral",
  };
  return map[status] ?? "neutral";
};

const activeCard = ref<string | null>(null);

const toggleActiveCard = (id: string) => {
  activeCard.value = activeCard.value === id ? null : id;
};

const closeActiveCard = () => {
  activeCard.value = null;
};
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-4" @click="closeActiveCard">
    <div
      v-for="col in columns"
      :key="col.id"
      class="flex min-w-[280px] flex-1 flex-col rounded-2xl border"
      :class="[col.borderColor, col.bgColor]"
    >
      <!-- Column header -->
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full" :class="col.color.replace('text-', 'bg-')" />
          <h3 class="text-sm font-semibold" :class="col.color">{{ col.title }}</h3>
        </div>
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="[col.color, col.borderColor, 'border']"
        >
          {{ groupedAppointments[col.id]?.length ?? 0 }}
        </span>
      </div>

      <!-- Cards -->
      <div class="flex flex-1 flex-col gap-3 px-3 pb-3">
        <template v-if="(groupedAppointments[col.id] ?? []).length > 0">
          <div
            v-for="apt in groupedAppointments[col.id]"
            :key="apt.id"
            class="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            :class="{ 'ring-2 ring-primary-500 dark:ring-primary-400': activeCard === apt.id }"
            @click.stop="toggleActiveCard(apt.id)"
          >
            <!-- Time badge -->
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ formatTime(apt.startTime) }}
              </span>
              <UBadge :color="statusBadgeColor(apt.status)" variant="soft" size="xs">
                {{ statusLabel(apt.status) }}
              </UBadge>
            </div>

            <!-- Customer -->
            <div class="mb-2 flex items-center gap-2">
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                :class="apt.isWalkIn ? 'bg-amber-500' : 'bg-primary-500'"
              >
                {{ getInitials(apt.customerName) }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-slate-950 dark:text-white">
                  {{ apt.customerName }}
                </p>
                <p v-if="apt.customerPhone" class="truncate text-xs text-slate-400 dark:text-slate-500">
                  {{ apt.customerPhone }}
                </p>
              </div>
              <UBadge v-if="apt.isWalkIn" color="amber" variant="outline" size="xs" class="shrink-0">
                Walk-in
              </UBadge>
            </div>

            <!-- Service + Employee -->
            <div class="space-y-1">
              <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <UIcon name="i-lucide-scissors" class="h-3.5 w-3.5 text-slate-400" />
                <span class="truncate">{{ apt.serviceName }}</span>
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <UIcon name="i-lucide-user" class="h-3.5 w-3.5 text-slate-400" />
                <span class="truncate">{{ apt.employeeName }}</span>
              </div>
            </div>

            <!-- Notes preview -->
            <p v-if="apt.notes" class="mt-2 truncate text-xs text-slate-400 dark:text-slate-500">
              {{ apt.notes }}
            </p>

            <!-- Action indicator (always visible) -->
            <div class="absolute right-2 top-2 text-slate-300 dark:text-slate-600">
              <UIcon name="i-lucide-ellipsis-vertical" class="h-4 w-4" />
            </div>

            <!-- Actions overlay (hover on desktop / tap on touch) -->
            <div
              class="absolute inset-0 flex items-center justify-center gap-1 rounded-xl bg-white/90 opacity-0 transition-opacity dark:bg-slate-900/90"
              :class="[
                { 'opacity-100': activeCard === apt.id },
                '[@media(hover:hover)]:group-hover:opacity-100'
              ]"
            >
              <UButton
                title="Editar"
                color="primary"
                variant="ghost"
                size="xs"
                icon="i-lucide-pencil"
                class="min-h-7 justify-center"
                :disabled="['cancelled', 'completed'].includes(apt.status)"
                @click="emits('edit', apt)"
              />

              <UButton
                v-if="canMutateStatuses && ['pending', 'confirmed'].includes(apt.status)"
                title="Check-in"
                color="warning"
                variant="ghost"
                size="xs"
                icon="i-lucide-play-circle"
                class="min-h-7 justify-center"
                :disabled="mutationLoading"
                @click="emits('toggle-status', apt, 'in_progress')"
              />

              <UButton
                v-if="canMutateStatuses && apt.status === 'in_progress'"
                title="Completar"
                color="success"
                variant="ghost"
                size="xs"
                icon="i-lucide-badge-check"
                class="min-h-7 justify-center"
                :disabled="mutationLoading"
                @click="emits('toggle-status', apt, 'completed')"
              />

              <UButton
                v-if="['confirmed', 'in_progress'].includes(apt.status)"
                title="Cobrar en POS"
                color="primary"
                variant="ghost"
                size="xs"
                icon="i-lucide-credit-card"
                class="min-h-7 justify-center"
                @click="emits('checkout', apt)"
              />

              <UButton
                v-if="apt.status === 'completed'"
                title="Ver recibo"
                color="success"
                variant="ghost"
                size="xs"
                icon="i-lucide-receipt"
                class="min-h-7 justify-center"
                @click="emits('view-receipt', apt)"
              />

              <UButton
                title="Cancelar"
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-ban"
                class="min-h-7 justify-center"
                :disabled="['cancelled', 'completed'].includes(apt.status)"
                @click="emits('cancel', apt)"
              />

              <UButton
                title="No asistio"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-user-x"
                class="min-h-7 justify-center"
                :disabled="['cancelled', 'completed', 'no_show'].includes(apt.status)"
                @click="emits('no-show', apt)"
              />
            </div>
          </div>
        </template>

        <!-- Empty column -->
        <template v-else>
          <div class="flex flex-1 items-center justify-center py-8">
            <div class="text-center">
              <UIcon name="i-lucide-calendar-x" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">Sin citas</p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
