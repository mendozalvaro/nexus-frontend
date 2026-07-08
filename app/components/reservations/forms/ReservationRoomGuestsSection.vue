<script setup lang="ts">
import type { ReservationGuestSuggestion } from "@/composables/useReservations";
import ReservationGuestCard from "@/components/reservations/forms/ReservationGuestCard.vue";
import type { RoomGuestField, SelectedRoom } from "./reservation-create.types";

defineProps<{
  room: SelectedRoom;
  roomIndex: number;
  roomError?: string;
  documentTypeOptions: Array<{ label: string; value: string }>;
  sexOptions: Array<{ label: string; value: string }>;
  nationalityOptions: Array<{ label: string; value: string }>;
  maritalStatusOptions: Array<{ label: string; value: string }>;
  getGuestError: (guestIndex: number, field: "documentNumber" | "documentType" | "fullName" | "birthDate" | "phone") => string | undefined;
}>();

const emit = defineEmits<{
  "add-companion": [];
  "set-main": [guestIndex: number];
  "remove-guest": [guestIndex: number];
  "queue-suggestions": [guestIndex: number];
  "blur-document": [guestIndex: number];
  "select-suggestion": [guestIndex: number, suggestion: ReservationGuestSuggestion];
  "update-field": [guestIndex: number, field: RoomGuestField, value: string];
}>();
</script>

<template>
  <div class="rounded-lg border border-default p-4">
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h4 class="font-medium">Hab. {{ room.roomNumber }}</h4>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ room.roomTypeName }}</p>
      </div>
      <UButton color="primary" variant="soft" icon="i-lucide-user-plus" @click="emit('add-companion')">
        Agregar acompanante
      </UButton>
    </div>

    <div class="space-y-4">
      <p v-if="roomError" class="text-xs text-red-600 dark:text-red-400">
        {{ roomError }}
      </p>

      <ReservationGuestCard
        v-for="(guest, guestIndex) in room.guests"
        :key="`${room.roomId}-${guestIndex}`"
        :guest="guest"
        :guest-index="guestIndex"
        :can-remove="room.guests.length > 1"
        :errors="{
          documentNumber: getGuestError(guestIndex, 'documentNumber'),
          documentType: getGuestError(guestIndex, 'documentType'),
          fullName: getGuestError(guestIndex, 'fullName'),
          birthDate: getGuestError(guestIndex, 'birthDate'),
          phone: getGuestError(guestIndex, 'phone'),
        }"
        :document-type-options="documentTypeOptions"
        :sex-options="sexOptions"
        :nationality-options="nationalityOptions"
        :marital-status-options="maritalStatusOptions"
        @set-main="emit('set-main', guestIndex)"
        @remove="emit('remove-guest', guestIndex)"
        @queue-suggestions="emit('queue-suggestions', guestIndex)"
        @blur-document="emit('blur-document', guestIndex)"
        @select-suggestion="emit('select-suggestion', guestIndex, $event)"
        @update-field="(field, value) => emit('update-field', guestIndex, field, value)"
      />
    </div>
  </div>
</template>
