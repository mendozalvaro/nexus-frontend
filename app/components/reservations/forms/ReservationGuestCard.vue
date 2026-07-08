<script setup lang="ts">
import type { ReservationGuestSuggestion } from "@/composables/useReservations";
import type { RoomGuest, RoomGuestField } from "./reservation-create.types";

defineProps<{
  guest: RoomGuest;
  guestIndex: number;
  canRemove: boolean;
  errors: Partial<Record<"documentNumber" | "documentType" | "fullName" | "birthDate" | "phone", string>>;
  documentTypeOptions: Array<{ label: string; value: string }>;
  sexOptions: Array<{ label: string; value: string }>;
  nationalityOptions: Array<{ label: string; value: string }>;
  maritalStatusOptions: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  "update-field": [field: RoomGuestField, value: string];
  "queue-suggestions": [];
  "blur-document": [];
  "select-suggestion": [suggestion: ReservationGuestSuggestion];
  "set-main": [];
  remove: [];
}>();
</script>

<template>
  <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-2">
        <UBadge :color="guest.isMainGuest ? 'primary' : 'neutral'" variant="soft">
          {{ guest.isMainGuest ? "Huesped principal" : `Acompanante ${guestIndex}` }}
        </UBadge>
        <UButton
          v-if="!guest.isMainGuest"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="emit('set-main')"
        >
          Marcar principal
        </UButton>
      </div>

      <UButton
        v-if="canRemove"
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-trash-2"
        @click="emit('remove')"
      >
        Quitar
      </UButton>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <UFormField :error="errors.documentNumber">
        <UInput
          :model-value="guest.documentNumber"
          placeholder="Numero de documento"
          @update:model-value="emit('update-field', 'documentNumber', String($event ?? '')); emit('queue-suggestions')"
          @blur="emit('blur-document')"
          class="w-full"
        />
        <div
          v-if="guest.suggestionsOpen && guest.suggestions.length"
          class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950"
        >
          <button
            v-for="suggestion in guest.suggestions"
            :key="`${suggestion.guestCustomerId ?? 'guest'}-${suggestion.documentType ?? 'doc'}-${suggestion.documentNumber ?? 'num'}`"
            type="button"
            class="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
            @mousedown.prevent="emit('select-suggestion', suggestion)"
          >
            <span class="text-sm font-medium text-slate-950 dark:text-white">{{ suggestion.fullName }}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ suggestion.documentType || "Doc." }} {{ suggestion.documentNumber || "-" }}
            </span>
          </button>
        </div>
        <p
          v-if="guest.lookupMessage"
          class="text-xs"
          :class="guest.lookupState === 'found' ? 'text-emerald-600 dark:text-emerald-300' : guest.lookupState === 'loading' ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-300'"
        >
          {{ guest.lookupMessage }}
        </p>
      </UFormField>

      <UFormField :error="errors.documentType">
        <USelectMenu
          :model-value="guest.documentType"
          :items="documentTypeOptions"
          value-key="value"
          label-key="label"
          placeholder="Tipo de documento"
          @update:model-value="emit('update-field', 'documentType', String($event ?? ''))"
          class="w-full"
        />
      </UFormField>

      <UFormField :error="errors.fullName">
        <UInput
          :model-value="guest.fullName"
          placeholder="Nombre completo"
          @update:model-value="emit('update-field', 'fullName', String($event ?? ''))"
          class="w-full"
        />
      </UFormField>

      <UFormField :error="errors.birthDate">
        <UInput
          :model-value="guest.birthDate"
          type="date"
          class="w-full"
          @update:model-value="emit('update-field', 'birthDate', String($event ?? ''))"
        />
      </UFormField>

      <USelectMenu
        :model-value="guest.sex"
        :items="sexOptions"
        value-key="value"
        label-key="label"
        placeholder="Sexo"
        @update:model-value="emit('update-field', 'sex', String($event ?? ''))"
      />

      <UFormField v-if="guest.isMainGuest" :error="errors.phone">
        <UInput
          :model-value="guest.phone"
          placeholder="Celular"
          class="w-full"
          @update:model-value="emit('update-field', 'phone', String($event ?? ''))"
        />
      </UFormField>

      <UInput
        v-if="guest.isMainGuest"
        :model-value="guest.email"
        type="email"
        placeholder="Correo electronico"
        @update:model-value="emit('update-field', 'email', String($event ?? ''))"
      />

      <USelectMenu
        :model-value="guest.nationality"
        :items="nationalityOptions"
        value-key="value"
        label-key="label"
        placeholder="Nacionalidad"
        @update:model-value="emit('update-field', 'nationality', String($event ?? ''))"
      />

      <USelectMenu
        :model-value="guest.maritalStatus"
        :items="maritalStatusOptions"
        value-key="value"
        label-key="label"
        placeholder="Estado civil"
        @update:model-value="emit('update-field', 'maritalStatus', String($event ?? ''))"
      />

      <UTextarea
        :model-value="guest.address"
        :rows="2"
        placeholder="Procedencia o direccion"
        class="md:col-span-2 xl:col-span-3"
        @update:model-value="emit('update-field', 'address', String($event ?? ''))"
      />
    </div>
  </div>
</template>
