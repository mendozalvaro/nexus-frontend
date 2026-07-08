<script setup lang="ts">
import type { CatalogRoomItem } from "@/composables/useCatalog";
import type { SelectedRoom } from "./reservation-create.types";

defineProps<{
  openEnded: boolean;
  nights: number;
  checkIn: string;
  groups: Array<{ name: string; rooms: CatalogRoomItem[] }>;
  branchId: string;
  roomsError?: string;
  selectedRooms: SelectedRoom[];
}>();

const emit = defineEmits<{
  "add-room": [room: CatalogRoomItem];
  "remove-room": [index: number];
}>();
</script>

<template>
  <UCard>
    <template #header><h3 class="font-semibold">Habitaciones disponibles</h3></template>
    <div class="space-y-4">
      <p class="text-sm text-muted">
        {{ openEnded ? "Estadia indefinida" : `${nights} noche(s)` }} desde {{ checkIn }}.
      </p>

      <div v-for="group in groups" :key="group.name" class="rounded-lg border border-default p-4">
        <span class="font-medium">{{ group.name }}</span>
        <div class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <UButton
            v-for="room in group.rooms"
            :key="room.id"
            color="neutral"
            variant="soft"
            @click="emit('add-room', room)"
          >
            Hab. {{ room.roomNumber }}
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="!groups.length"
        color="neutral"
        variant="soft"
        icon="i-lucide-info"
        :title="branchId ? 'No hay habitaciones disponibles para ese ingreso.' : 'Selecciona una sucursal para cargar habitaciones disponibles.'"
      />

      <p v-if="roomsError" class="text-xs text-red-600 dark:text-red-400">
        {{ roomsError }}
      </p>

      <div v-if="selectedRooms.length" class="space-y-2">
        <div
          v-for="(room, index) in selectedRooms"
          :key="room.roomId"
          class="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 md:flex-row md:items-center md:justify-between"
        >
          <div class="flex items-center gap-2">
            <span>Hab. {{ room.roomNumber }} ({{ room.roomTypeName }})</span>
            <UBadge color="neutral" variant="soft">Tarifa: ${{ room.roomPrice.toFixed(2) }}</UBadge>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('remove-room', index)">Quitar</UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
