<script setup lang="ts">
import type {
  AppointmentCalendarView,
  AppointmentListItem,
} from "@/composables/useAppointments";

const props = withDefaults(defineProps<{
  appointments: AppointmentListItem[];
  view: AppointmentCalendarView;
  selectedDate: string;
  loading?: boolean;
  timezone?: string;
}>(), {
  loading: false,
  timezone: "UTC",
});

const emits = defineEmits<{
  "update:view": [AppointmentCalendarView];
  "update:selectedDate": [string];
  "select-appointment": [AppointmentListItem];
  "select-slot": [{ date: string; hour?: string }];
}>();

const weekdays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const hourSlots = Array.from({ length: 13 }, (_, index) => {
  const hour = String(index + 8).padStart(2, "0");
  return `${hour}:00`;
});

const parseLocalDate = (value: string): Date => new Date(`${value}T00:00:00`);

const toDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const startOfWeek = (value: Date): Date => {
  const currentDay = value.getDay();
  const delta = currentDay === 0 ? -6 : 1 - currentDay;
  return addDays(value, delta);
};

const selectedDateObject = computed(() => parseLocalDate(props.selectedDate));

const rangeLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat("es-BO", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: props.timezone,
  });

  if (props.view === "day") {
    return formatter.format(selectedDateObject.value);
  }

  if (props.view === "week") {
    const start = startOfWeek(selectedDateObject.value);
    const end = addDays(start, 6);
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  return new Intl.DateTimeFormat("es-BO", {
    month: "long",
    year: "numeric",
    timeZone: props.timezone,
  }).format(selectedDateObject.value);
});

const visibleDays = computed(() => {
  if (props.view === "day") {
    return [toDateInput(selectedDateObject.value)];
  }

  if (props.view === "week") {
    const start = startOfWeek(selectedDateObject.value);
    return Array.from({ length: 7 }, (_, index) => toDateInput(addDays(start, index)));
  }

  const monthStart = new Date(
    selectedDateObject.value.getFullYear(),
    selectedDateObject.value.getMonth(),
    1,
  );
  const calendarStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => toDateInput(addDays(calendarStart, index)));
});

const appointmentsByDay = computed(() => {
  return props.appointments.reduce<Record<string, AppointmentListItem[]>>((accumulator, appointment) => {
    const dateKey = toDateInput(new Date(appointment.startTime));
    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }

    accumulator[dateKey]?.push(appointment);
    return accumulator;
  }, {});
});

const timeFormatter = computed(() => new Intl.DateTimeFormat("es-BO", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: props.timezone,
}));

const dayFormatter = (value: string) => new Intl.DateTimeFormat("es-BO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: props.timezone,
}).format(parseLocalDate(value));

const monthDayNumber = (value: string) => parseLocalDate(value).getDate();

const isCurrentMonthDay = (value: string) => {
  const parsed = parseLocalDate(value);
  return parsed.getMonth() === selectedDateObject.value.getMonth();
};

const isToday = (value: string) => value === toDateInput(new Date());
const isSelected = (value: string) => value === props.selectedDate;

const formatTime = (value: string) => timeFormatter.value.format(new Date(value));

const moveCalendar = (direction: "prev" | "next") => {
  const anchor = selectedDateObject.value;
  const amount = direction === "next" ? 1 : -1;

  if (props.view === "day") {
    emits("update:selectedDate", toDateInput(addDays(anchor, amount)));
    return;
  }

  if (props.view === "week") {
    emits("update:selectedDate", toDateInput(addDays(anchor, amount * 7)));
    return;
  }

  const next = new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1);
  emits("update:selectedDate", toDateInput(next));
};

const resetToToday = () => {
  emits("update:selectedDate", toDateInput(new Date()));
};

const selectMonthDay = (day: string) => {
  emits("update:selectedDate", day);
  emits("update:view", "day");
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Agenda local
        </p>
        <h2 class="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
          {{ rangeLabel }}
        </h2>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="soft" icon="i-lucide-chevron-left" @click="moveCalendar('prev')">
          Anterior
        </UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-calendar-days" @click="resetToToday">
          Hoy
        </UButton>
        <UButton color="neutral" variant="soft" trailing-icon="i-lucide-chevron-right" @click="moveCalendar('next')">
          Siguiente
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="loading"
      color="neutral"
      variant="soft"
      icon="i-lucide-loader-circle"
      title="Cargando agenda"
      description="Estamos sincronizando las citas visibles para el rango seleccionado."
    />

    <div v-else-if="view === 'month'" class="grid gap-3 md:grid-cols-7">
      <div
        v-for="weekday in weekdays"
        :key="weekday"
        class="hidden text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 md:block"
      >
        {{ weekday }}
      </div>

      <button
        v-for="day in visibleDays"
        :key="day"
        type="button"
        class="flex min-h-[10rem] flex-col rounded-[1.25rem] border p-3 text-left transition hover:-translate-y-0.5"
        :class="[
          isSelected(day)
            ? 'border-primary-400 bg-primary-50/80 dark:border-primary-500 dark:bg-primary-950/40'
            : 'border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80',
          !isCurrentMonthDay(day) ? 'opacity-55' : '',
        ]"
        @click="selectMonthDay(day)"
      >
        <div class="flex items-center justify-between">
          <span
            class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
            :class="isToday(day) ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-700 dark:text-slate-200'"
          >
            {{ monthDayNumber(day) }}
          </span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus" @click.stop="emits('select-slot', { date: day })">
            Agendar
          </UButton>
        </div>

        <div class="mt-3 space-y-2">
          <button
            v-for="appointment in (appointmentsByDay[day] ?? []).slice(0, 3)"
            :key="appointment.id"
            type="button"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs dark:border-slate-800 dark:bg-slate-800/70"
            @click.stop="emits('select-appointment', appointment)"
          >
            <p class="font-semibold text-slate-950 dark:text-white">
              {{ formatTime(appointment.startTime) }} · {{ appointment.customerName }}
            </p>
            <p class="mt-1 text-slate-500 dark:text-slate-400">
              {{ appointment.serviceName }}
            </p>
          </button>
        </div>

        <p v-if="(appointmentsByDay[day] ?? []).length > 3" class="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400">
          +{{ (appointmentsByDay[day] ?? []).length - 3 }} cita(s) más
        </p>
      </button>
    </div>

    <div v-else class="space-y-4">
      <div class="grid gap-4" :class="view === 'week' ? 'xl:grid-cols-7' : 'grid-cols-1'">
        <div
          v-for="day in visibleDays"
          :key="day"
          class="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-slate-950 dark:text-white">
                {{ dayFormatter(day) }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ (appointmentsByDay[day] ?? []).length }} cita(s)
              </p>
            </div>

            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus" @click="emits('select-slot', { date: day })">
              Nueva
            </UButton>
          </div>

          <div class="mt-4 space-y-3">
            <div
              v-for="hour in hourSlots"
              :key="`${day}-${hour}`"
              class="rounded-2xl border border-dashed border-slate-200 p-3 dark:border-slate-800"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {{ hour }}
                </span>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus" @click="emits('select-slot', { date: day, hour })">
                  Bloque
                </UButton>
              </div>

              <div class="space-y-2">
                <button
                  v-for="appointment in (appointmentsByDay[day] ?? []).filter((item) => formatTime(item.startTime).startsWith(hour.slice(0, 2)))"
                  :key="appointment.id"
                  type="button"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left dark:border-slate-800 dark:bg-slate-800/70"
                  @click="emits('select-appointment', appointment)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-semibold text-slate-950 dark:text-white">
                        {{ appointment.customerName }}
                      </p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">
                        {{ appointment.serviceName }} · {{ formatTime(appointment.startTime) }} - {{ formatTime(appointment.endTime) }}
                      </p>
                    </div>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {{ appointment.status }}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
