<script setup lang="ts">
import type { ReservationRoomBoardItem } from "@/composables/useReservations";

defineProps<{
  rooms: ReservationRoomBoardItem[];
}>();

const emit = defineEmits<{
  create: [];
  detail: [reservationId: string];
  payment: [reservationId: string];
  checkout: [reservationId: string];
  extend: [reservationId: string];
}>();
</script>

<template>
  <UiSectionShell
    eyebrow="Operacion"
    title="Habitaciones activas"
    description="Vista operativa de disponibilidad, huesped actual y acciones rapidas por habitacion."
  >
    <div class="flex flex-wrap items-center justify-end gap-3">
      <UButton color="primary" icon="i-lucide-plus" @click="emit('create')">
        Nuevo ingreso
      </UButton>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <UCard
        v-for="room in rooms"
        :key="room.roomId"
        class="rounded-[1.5rem] border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
      >
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{{ room.branchName }}</p>
              <h4 class="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Hab. {{ room.roomNumber }}</h4>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ room.roomTypeName }}</p>
            </div>

            <UBadge :color="room.status === 'occupied' ? 'warning' : 'success'" variant="soft" size="sm">
              {{ room.status === "occupied" ? "En uso" : "Disponible" }}
            </UBadge>
          </div>

          <div class="grid gap-3 rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-900/80">
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                <UIcon name="i-lucide-user-round" class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Huesped</p>
                <p class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ room.guestName || "Sin ocupacion" }}</p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <UIcon name="i-lucide-log-out" class="h-4 w-4" />
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Salida</p>
                <p class="text-sm font-medium text-slate-900 dark:text-white">
                  {{ room.isOpenEnded ? "Indefinido" : (room.checkOut || "-") }}
                </p>
              </div>
            </div>

            <div v-if="room.reservationId" class="flex items-start gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <UIcon name="i-lucide-wallet" class="h-4 w-4" />
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Saldo</p>
                <p class="text-sm font-medium" :class="room.balance > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'">
                  ${{ room.balance.toFixed(2) }}
                </p>
              </div>
            </div>
          </div>

          <div v-if="room.reservationId" class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="soft" size="sm" @click="emit('detail', room.reservationId)">
              Ver detalle
            </UButton>
            <UButton v-if="room.balance > 0" color="primary" size="sm" @click="emit('payment', room.reservationId)">
              Cobrar
            </UButton>
            <UButton v-if="room.status === 'occupied'" color="neutral" variant="soft" size="sm" @click="emit('checkout', room.reservationId)">
              Registrar salida
            </UButton>
            <UButton v-if="room.status === 'occupied'" color="neutral" variant="soft" size="sm" @click="emit('extend', room.reservationId)">
              Agregar estadia
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UiSectionShell>
</template>
