<script setup lang="ts">
import type { CatalogRoomItem } from "@/composables/useCatalog";
import type { ReservationGuestSuggestion } from "@/composables/useReservations";
import ReservationAvailableRoomsSection from "@/components/reservations/forms/ReservationAvailableRoomsSection.vue";
import ReservationPaymentSection from "@/components/reservations/forms/ReservationPaymentSection.vue";
import ReservationQuickCheckinSection from "@/components/reservations/forms/ReservationQuickCheckinSection.vue";
import ReservationRoomGuestsSection from "@/components/reservations/forms/ReservationRoomGuestsSection.vue";
import type { GuestSex, RoomGuest, RoomGuestField, SelectedRoom } from "@/components/reservations/forms/reservation-create.types";
import { countriesList } from "@/utils/constants";

type StayPreset = "day" | "week" | "month" | "open" | "custom";

const emit = defineEmits<{
  created: [{ reservationId: string; goToPayment: boolean }];
  cancel: [];
}>();

const { createReservation, lookupGuestByDocument, searchGuestsByDocument } = useReservations();
const { getAccessibleBranches } = usePermissions();
const { selectedBranchId } = useUserContext();
const { loadAvailableRooms, loadRooms } = useCatalog();
const toast = useToast();

const todayIso = new Date().toISOString().slice(0, 10);

const STAY_PRESET_OPTIONS: Array<{ value: StayPreset; label: string }> = [
  { value: "day", label: "1 dia" },
  { value: "week", label: "1 semana" },
  { value: "month", label: "1 mes" },
  { value: "open", label: "Indefinido" },
  { value: "custom", label: "Personalizado" },
];

const SEX_OPTIONS = [
  { label: "Masculino", value: "male" },
  { label: "Femenino", value: "female" },
  { label: "Otro", value: "other" },
] satisfies Array<{ label: string; value: GuestSex }>;

const MARITAL_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Soltero/a", value: "soltero" },
  { label: "Casado/a", value: "casado" },
  { label: "Divorciado/a", value: "divorciado" },
  { label: "Viudo/a", value: "viudo" },
  { label: "Union libre", value: "union_libre" },
];

const DOCUMENT_TYPE_OPTIONS = [
  { label: "CI", value: "CI" },
  { label: "NIT", value: "NIT" },
  { label: "Pasaporte", value: "Pasaporte" },
  { label: "Otro", value: "Otro" },
];

const NATIONALITY_OPTIONS: Array<{ label: string; value: string }> = countriesList.map(({ label }) => ({ label, value: label }));

const PAYMENT_METHOD_OPTIONS = [
  { label: "Efectivo", value: "cash" },
  { label: "Tarjeta", value: "card" },
  { label: "Transferencia", value: "transfer" },
  { label: "QR", value: "qr" },
  { label: "Billetera digital", value: "digital_wallet" },
];

const loading = ref(false);
const error = ref<string | null>(null);
const formErrors = ref<Record<string, string>>({});
const branches = ref<Array<{ label: string; value: string }>>([]);
const availableRooms = ref<CatalogRoomItem[]>([]);
const stayPreset = ref<StayPreset>("day");

const form = reactive({
  branchId: "",
  checkIn: todayIso,
  checkOut: "",
  openEnded: false,
  rooms: [] as SelectedRoom[],
  notes: "",
  goToPayment: false,
  registerPaymentNow: false,
  paymentAmount: 0,
  paymentMethod: "cash",
  paymentReference: "",
});

const resolveAutomaticPaymentType = (amount: number, total: number) => amount >= total ? "full" : "deposit";

const createGuest = (isMainGuest: boolean): RoomGuest => ({
  guestCustomerId: null,
  fullName: "",
  documentType: "CI",
  documentNumber: "",
  birthDate: "",
  sex: "male",
  phone: "",
  email: "",
  nationality: "Bolivia",
  maritalStatus: "",
  address: "",
  isMainGuest,
  lookupMessage: null,
  lookupState: "idle",
  suggestions: [],
  suggestionsOpen: false,
});

const suggestionTimers = new Map<string, ReturnType<typeof setTimeout>>();

const getGuestKey = (roomIndex: number, guestIndex: number) => `${roomIndex}:${guestIndex}`;
const getGuestFieldKey = (roomIndex: number, guestIndex: number, field: string) => `${getGuestKey(roomIndex, guestIndex)}:${field}`;

const setFieldError = (key: string, message?: string) => {
  if (message) {
    formErrors.value[key] = message;
    return;
  }
  delete formErrors.value[key];
};

const getFieldError = (key: string) => formErrors.value[key];
const clearFieldError = (key: string) => setFieldError(key);
const clearGuestFieldError = (roomIndex: number, guestIndex: number, field: string) => clearFieldError(getGuestFieldKey(roomIndex, guestIndex, field));

const clearGuestSuggestionTimer = (roomIndex: number, guestIndex: number) => {
  const timerKey = getGuestKey(roomIndex, guestIndex);
  const existingTimer = suggestionTimers.get(timerKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    suggestionTimers.delete(timerKey);
  }
};

const assignGuestLookupResult = (
  guest: RoomGuest,
  result: ReservationGuestSuggestion & Partial<{
    birthDate: string | null;
    sex: GuestSex | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    address: string | null;
    maritalStatus: string | null;
  }>,
) => {
  guest.guestCustomerId = result.guestCustomerId;
  guest.fullName = result.fullName || guest.fullName;
  guest.documentType = result.documentType || guest.documentType;
  guest.documentNumber = result.documentNumber || guest.documentNumber;
  guest.birthDate = result.birthDate || guest.birthDate;
  guest.sex = result.sex || guest.sex;
  guest.phone = result.phone || guest.phone;
  guest.email = result.email || guest.email;
  guest.nationality = result.nationality || guest.nationality;
  guest.address = result.address || guest.address;
  guest.maritalStatus = result.maritalStatus || guest.maritalStatus;
};

const addDaysIso = (value: string, days: number) => {
  const nextDate = new Date(`${value}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const addCalendarMonthIso = (value: string) => {
  const source = new Date(`${value}T00:00:00`);
  const nextDate = new Date(source);
  const originalDay = nextDate.getDate();
  nextDate.setMonth(nextDate.getMonth() + 1);
  if (nextDate.getDate() < originalDay) {
    nextDate.setDate(0);
  }
  return nextDate.toISOString().slice(0, 10);
};

const resolveCheckoutForPreset = (checkIn: string, preset: StayPreset) => {
  if (preset === "custom") {
    return form.checkOut || addDaysIso(checkIn, 1);
  }

  if (preset === "day") {
    return addDaysIso(checkIn, 1);
  }

  if (preset === "week") {
    return addDaysIso(checkIn, 7);
  }

  return addCalendarMonthIso(checkIn);
};

onMounted(async () => {
  form.checkOut = addDaysIso(todayIso, 1);

  try {
    const accessibleBranches = await getAccessibleBranches();
    branches.value = accessibleBranches.map((branch) => ({ label: branch.name, value: branch.id }));
  } catch {
    const rooms = await loadRooms();
    const byBranch = new Map<string, string>();
    for (const room of rooms) {
      if (!byBranch.has(room.branchId)) {
        byBranch.set(room.branchId, room.branchName);
      }
    }
    branches.value = Array.from(byBranch.entries()).map(([value, label]) => ({ label, value }));
  }

  if (!form.branchId) {
    const defaultBranchId = selectedBranchId.value ?? branches.value[0]?.value ?? "";
    form.branchId = branches.value.some((branch) => branch.value === defaultBranchId)
      ? defaultBranchId
      : (branches.value[0]?.value ?? "");
  }

  await onCriteriaChange();
});

const effectiveCheckOut = computed(() => form.openEnded ? addDaysIso(form.checkIn, 1) : form.checkOut);

const nights = computed(() => {
  const diff = new Date(effectiveCheckOut.value).getTime() - new Date(form.checkIn).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

const totalAmount = computed(() =>
  form.rooms.reduce((sum, room) => sum + (room.roomPrice * nights.value), 0),
);

const availableRoomGroups = computed(() => {
  const selectedIds = new Set(form.rooms.map((room) => room.roomId));
  const rooms = availableRooms.value.filter((room) => !selectedIds.has(room.id));
  const groups = new Map<string, CatalogRoomItem[]>();
  for (const room of rooms) {
    const key = room.categoryName || "Sin categoria";
    const current = groups.get(key) ?? [];
    current.push(room);
    groups.set(key, current);
  }
  return Array.from(groups.entries()).map(([name, rooms]) => ({ name, rooms }));
});

const refreshAvailableRooms = async () => {
  if (!form.branchId || !form.checkIn || !effectiveCheckOut.value) {
    return;
  }

  try {
    availableRooms.value = await loadAvailableRooms({
      branchId: form.branchId,
      checkIn: form.checkIn,
      checkOut: effectiveCheckOut.value,
    });
  } catch (refreshError) {
    error.value = refreshError instanceof Error ? refreshError.message : "No se pudo validar disponibilidad.";
    availableRooms.value = [];
  }
};

const onCriteriaChange = async () => {
  form.rooms = [];
  setFieldError("rooms");
  await refreshAvailableRooms();
};

const setStayPreset = async (preset: StayPreset) => {
  stayPreset.value = preset;
  form.openEnded = preset === "open";
  if (preset !== "custom" && preset !== "open") {
    form.checkOut = resolveCheckoutForPreset(form.checkIn, preset);
  }
  if (preset === "open") {
    form.checkOut = addDaysIso(form.checkIn, 1);
  }
  await onCriteriaChange();
};

const addRoom = (room: CatalogRoomItem) => {
  if (form.rooms.some((selectedRoom) => selectedRoom.roomId === room.id)) {
    return;
  }

  form.rooms.push({
    roomId: room.id,
    roomNumber: room.roomNumber,
    roomPrice: Number(room.basePrice ?? 0),
    roomTypeName: room.categoryName,
    guests: [createGuest(true)],
  });
  setFieldError("rooms");
};

const removeRoom = (index: number) => {
  form.rooms.splice(index, 1);
  if (form.rooms.length > 0) {
    setFieldError("rooms");
  }
};

const addCompanion = (roomIndex: number) => {
  form.rooms[roomIndex]?.guests.push(createGuest(false));
};

const removeGuest = (roomIndex: number, guestIndex: number) => {
  const room = form.rooms[roomIndex];
  if (!room) {
    return;
  }

  const removedGuest = room.guests[guestIndex];
  room.guests.splice(guestIndex, 1);

  if (removedGuest?.isMainGuest && room.guests.length > 0) {
    room.guests[0]!.isMainGuest = true;
  }
};

const setMainGuest = (roomIndex: number, guestIndex: number) => {
  const room = form.rooms[roomIndex];
  if (!room) {
    return;
  }

  room.guests.forEach((guest, index) => {
    guest.isMainGuest = index === guestIndex;
  });
};

const updateGuestField = (roomIndex: number, guestIndex: number, field: RoomGuestField, value: string) => {
  const guest = form.rooms[roomIndex]?.guests[guestIndex];
  if (!guest) {
    return;
  }

  if (field === "sex") {
    guest.sex = value as GuestSex;
  } else {
    guest[field] = value;
  }

  if (field === "documentNumber" || field === "documentType" || field === "fullName" || field === "birthDate" || field === "phone") {
    clearGuestFieldError(roomIndex, guestIndex, field);
  }
};

const validateForm = () => {
  formErrors.value = {};

  if (!form.branchId) {
    setFieldError("branchId", "La sucursal es obligatoria.");
  }

  if (!form.rooms.length) {
    setFieldError("rooms", "Agrega al menos una habitacion.");
  }

  form.rooms.forEach((room, roomIndex) => {
    const mainGuest = room.guests.find((guest) => guest.isMainGuest);
    if (!mainGuest) {
      setFieldError(`room:${roomIndex}`, `La habitacion ${room.roomNumber} requiere un huesped principal.`);
    }

    room.guests.forEach((guest, guestIndex) => {
      if (!guest.documentNumber.trim()) {
        setFieldError(getGuestFieldKey(roomIndex, guestIndex, "documentNumber"), "Documento requerido.");
      }
      if (!guest.documentType.trim()) {
        setFieldError(getGuestFieldKey(roomIndex, guestIndex, "documentType"), "Tipo requerido.");
      }
      if (!guest.fullName.trim()) {
        setFieldError(getGuestFieldKey(roomIndex, guestIndex, "fullName"), "Nombre requerido.");
      }
      if (!guest.birthDate) {
        setFieldError(getGuestFieldKey(roomIndex, guestIndex, "birthDate"), "Fecha requerida.");
      }
      if (guest.isMainGuest && !guest.phone.trim()) {
        setFieldError(getGuestFieldKey(roomIndex, guestIndex, "phone"), "Celular requerido.");
      }
    });
  });

  if (form.registerPaymentNow) {
    if (form.paymentAmount <= 0) {
      setFieldError("paymentAmount", "Ingresa un monto mayor a cero.");
    } else if (form.paymentAmount > totalAmount.value) {
      setFieldError("paymentAmount", "El monto no puede exceder el total.");
    }
  }

  return Object.keys(formErrors.value).length === 0;
};

const hydrateGuestFromRegistry = async (roomIndex: number, guestIndex: number) => {
  const guest = form.rooms[roomIndex]?.guests[guestIndex];
  if (!guest) {
    return;
  }

  clearGuestSuggestionTimer(roomIndex, guestIndex);

  const documentNumber = guest.documentNumber.trim();
  if (!documentNumber) {
    guest.lookupMessage = null;
    guest.lookupState = "idle";
    guest.guestCustomerId = null;
    guest.suggestions = [];
    guest.suggestionsOpen = false;
    return;
  }

  guest.lookupState = "loading";
  guest.lookupMessage = "Buscando huesped registrado...";

  try {
    const result = await lookupGuestByDocument(documentNumber, guest.documentType);
    if (!result) {
      guest.lookupState = "missing";
      guest.lookupMessage = "Sin coincidencias registradas.";
      guest.guestCustomerId = null;
      return;
    }

    assignGuestLookupResult(guest, result);
    guest.lookupState = "found";
    guest.lookupMessage = `Huesped cargado: ${result.fullName}`;
    guest.suggestions = [];
    guest.suggestionsOpen = false;
  } catch (lookupError) {
    guest.lookupState = "missing";
    guest.lookupMessage = lookupError instanceof Error ? lookupError.message : "No se pudo buscar el huesped.";
  }
};

const applyGuestSuggestion = async (roomIndex: number, guestIndex: number, suggestion: ReservationGuestSuggestion) => {
  const guest = form.rooms[roomIndex]?.guests[guestIndex];
  if (!guest) {
    return;
  }

  assignGuestLookupResult(guest, suggestion);
  guest.suggestions = [];
  guest.suggestionsOpen = false;
  await hydrateGuestFromRegistry(roomIndex, guestIndex);
};

const queueGuestSuggestions = (roomIndex: number, guestIndex: number) => {
  const guest = form.rooms[roomIndex]?.guests[guestIndex];
  if (!guest) {
    return;
  }

  clearGuestSuggestionTimer(roomIndex, guestIndex);

  const documentNumber = guest.documentNumber.trim();
  if (documentNumber.length < 4) {
    guest.suggestions = [];
    guest.suggestionsOpen = false;
    if (!documentNumber) {
      guest.lookupMessage = null;
      guest.lookupState = "idle";
    }
    return;
  }

  guest.lookupState = "loading";
  guest.lookupMessage = "Buscando huespedes registrados...";

  const timerKey = getGuestKey(roomIndex, guestIndex);
  suggestionTimers.set(timerKey, setTimeout(async () => {
    try {
      const suggestions = await searchGuestsByDocument(documentNumber, guest.documentType);
      if (suggestions.length === 0) {
        const lookupResult = await lookupGuestByDocument(documentNumber, guest.documentType);
        if (lookupResult) {
          assignGuestLookupResult(guest, lookupResult);
          guest.suggestions = [];
          guest.suggestionsOpen = false;
          guest.lookupState = "found";
          guest.lookupMessage = `Huesped cargado: ${lookupResult.fullName}`;
          return;
        }
      }

      guest.suggestions = suggestions;
      guest.suggestionsOpen = suggestions.length > 0;
      guest.lookupState = suggestions.length > 0 ? "found" : "missing";
      guest.lookupMessage = suggestions.length > 0
        ? `${suggestions.length} coincidencia(s) encontrada(s).`
        : "Sin coincidencias registradas.";
    } catch (searchError) {
      guest.suggestions = [];
      guest.suggestionsOpen = false;
      guest.lookupState = "missing";
      guest.lookupMessage = searchError instanceof Error ? searchError.message : "No se pudo buscar el huesped.";
    } finally {
      suggestionTimers.delete(timerKey);
    }
  }, 250));
};

const handleSubmit = async () => {
  if (!validateForm()) {
    error.value = "Revisa los campos marcados.";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const payload = {
      branchId: form.branchId,
      checkIn: form.checkIn,
      checkOut: effectiveCheckOut.value,
      openEnded: form.openEnded,
      rooms: form.rooms.map((room) => ({
        roomId: room.roomId,
        guests: room.guests.map((guest) => ({
          fullName: guest.fullName.trim(),
          documentType: guest.documentType.trim(),
          documentNumber: guest.documentNumber.trim(),
          birthDate: guest.birthDate,
          sex: guest.sex,
          phone: guest.isMainGuest ? guest.phone.trim() : "",
          email: guest.isMainGuest ? guest.email.trim() : "",
          nationality: guest.nationality.trim(),
          address: guest.address.trim(),
          maritalStatus: guest.maritalStatus,
          isMainGuest: guest.isMainGuest,
        })),
      })),
      notes: form.notes || undefined,
      payment: form.registerPaymentNow && form.paymentAmount > 0
        ? {
            amount: Number(form.paymentAmount),
            paymentMethod: form.paymentMethod,
            paymentType: resolveAutomaticPaymentType(Number(form.paymentAmount), totalAmount.value),
            reference: form.paymentReference || undefined,
          }
        : undefined,
    };

    const result = await createReservation(payload);
    toast.add({ title: "Ingreso registrado", description: "La habitacion quedo en uso.", color: "success" });
    emit("created", { reservationId: result.reservationId, goToPayment: form.goToPayment });
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : "No se pudo registrar el ingreso.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="space-y-5">
    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-x" :title="error" />

    <ReservationQuickCheckinSection
      :branch-id="form.branchId"
      :branch-error="getFieldError('branchId')"
      :branches="branches"
      :check-in="form.checkIn"
      :check-out="form.checkOut"
      :stay-preset="stayPreset"
      :stay-preset-options="STAY_PRESET_OPTIONS"
      @update:branch-id="clearFieldError('branchId'); form.branchId = $event; onCriteriaChange()"
      @update:check-out="form.checkOut = $event; onCriteriaChange()"
      @select-preset="setStayPreset($event as StayPreset)"
    />

    <ReservationAvailableRoomsSection
      :open-ended="form.openEnded"
      :nights="nights"
      :check-in="form.checkIn"
      :groups="availableRoomGroups"
      :branch-id="form.branchId"
      :rooms-error="getFieldError('rooms')"
      :selected-rooms="form.rooms"
      @add-room="addRoom($event)"
      @remove-room="removeRoom($event)"
    />

    <UCard>
      <template #header><h3 class="font-semibold">Huespedes por habitacion</h3></template>
      <div class="space-y-4">
        <ReservationRoomGuestsSection
          v-for="(room, roomIndex) in form.rooms"
          :key="room.roomId"
          :room="room"
          :room-index="roomIndex"
          :room-error="getFieldError(`room:${roomIndex}`)"
          :document-type-options="DOCUMENT_TYPE_OPTIONS"
          :sex-options="SEX_OPTIONS"
          :nationality-options="NATIONALITY_OPTIONS"
          :marital-status-options="MARITAL_STATUS_OPTIONS"
          :get-guest-error="(guestIndex, field) => getFieldError(getGuestFieldKey(roomIndex, guestIndex, field))"
          @add-companion="addCompanion(roomIndex)"
          @set-main="setMainGuest(roomIndex, $event)"
          @remove-guest="removeGuest(roomIndex, $event)"
          @queue-suggestions="queueGuestSuggestions(roomIndex, $event)"
          @blur-document="hydrateGuestFromRegistry(roomIndex, $event)"
          @select-suggestion="(guestIndex, suggestion) => applyGuestSuggestion(roomIndex, guestIndex, suggestion)"
          @update-field="(guestIndex, field, value) => updateGuestField(roomIndex, guestIndex, field, value)"
        />

        <UFormField label="Notas">
          <UTextarea v-model="form.notes" placeholder="Notas opcionales..." class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <ReservationPaymentSection
      :register-payment-now="form.registerPaymentNow"
      :go-to-payment="form.goToPayment"
      :payment-amount="form.paymentAmount"
      :payment-amount-error="getFieldError('paymentAmount')"
      :payment-method="form.paymentMethod"
      :payment-reference="form.paymentReference"
      :total-amount="totalAmount"
      :payment-method-options="PAYMENT_METHOD_OPTIONS"
      @update:register-payment-now="form.registerPaymentNow = $event"
      @update:payment-amount="clearFieldError('paymentAmount'); form.paymentAmount = $event"
      @update:payment-method="form.paymentMethod = $event"
      @update:payment-reference="form.paymentReference = $event"
      @update:go-to-payment="form.goToPayment = $event"
    />

    <div class="flex justify-end gap-2">
      <UButton color="neutral" variant="ghost" @click="emit('cancel')">Cancelar</UButton>
      <UButton color="primary" :loading="loading" @click="handleSubmit">
        Registrar ingreso
      </UButton>
    </div>
  </div>
</template>
