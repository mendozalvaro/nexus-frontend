<script setup lang="ts">
import type { CatalogRoomItem } from "@/composables/useCatalog";
import { countriesList } from "@/utils/constants";

type StayPreset = "day" | "week" | "month" | "open" | "custom";
type GuestSex = "male" | "female" | "other";

type RoomGuest = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  sex: GuestSex;
  phone: string;
  email: string;
  nationality: string;
  maritalStatus: string;
  address: string;
  isMainGuest: boolean;
};

type SelectedRoom = {
  roomId: string;
  roomNumber: string;
  roomPrice: number;
  roomTypeName: string;
  guests: RoomGuest[];
};

const emit = defineEmits<{
  created: [{ reservationId: string; goToPayment: boolean }];
  cancel: [];
}>();

const { createReservation } = useReservations();
const { loadBranches } = useBranches();
const { loadAvailableRooms, loadRooms } = useCatalog();
const { siatBillingEnabled, loadSiatBilling } = useSiatBilling();
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

const PAYMENT_TYPE_OPTIONS = [
  { label: "Deposito", value: "deposit" },
  { label: "Saldo", value: "balance" },
  { label: "Completo", value: "full" },
];

const loading = ref(false);
const error = ref<string | null>(null);
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
  paymentType: "deposit",
  paymentReference: "",
});

const createGuest = (isMainGuest: boolean): RoomGuest => ({
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
});

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
  await loadSiatBilling();
  form.checkOut = addDaysIso(todayIso, 1);

  try {
    const branchData = await loadBranches();
    branches.value = (branchData.branches ?? []).map((branch) => ({ label: branch.name, value: branch.id }));
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
};

const removeRoom = (index: number) => {
  form.rooms.splice(index, 1);
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

const handleSubmit = async () => {
  loading.value = true;
  error.value = null;

  try {
    if (!form.branchId) {
      throw new Error("La sucursal es obligatoria.");
    }
    if (!form.rooms.length) {
      throw new Error("Agrega al menos una habitacion.");
    }

    for (const room of form.rooms) {
      const mainGuest = room.guests.find((guest) => guest.isMainGuest);
      if (!mainGuest) {
        throw new Error(`La habitacion ${room.roomNumber} requiere un huesped principal.`);
      }

      for (const guest of room.guests) {
        if (
          !guest.fullName.trim()
          || !guest.birthDate
          || (guest.isMainGuest && !guest.phone.trim())
          || (siatBillingEnabled.value && !guest.documentType.trim())
          || (siatBillingEnabled.value && !guest.documentNumber.trim())
        ) {
          throw new Error(`Completa los campos obligatorios de la habitacion ${room.roomNumber}.`);
        }
      }
    }

    const payload = {
      branchId: form.branchId,
      checkIn: form.checkIn,
      checkOut: effectiveCheckOut.value,
      openEnded: form.openEnded,
      rooms: form.rooms.map((room) => ({
        roomId: room.roomId,
        guests: room.guests.map((guest) => ({
          fullName: guest.fullName.trim(),
          documentType: siatBillingEnabled.value ? guest.documentType.trim() : "N/A",
          documentNumber: siatBillingEnabled.value ? guest.documentNumber.trim() : "N/A",
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
            paymentType: form.paymentType,
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

    <UCard>
      <template #header><h3 class="font-semibold">Ingreso rapido</h3></template>
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <UFormField label="Sucursal" required>
            <USelectMenu v-model="form.branchId" :items="branches" value-key="value" label-key="label" placeholder="Seleccionar..." class="w-full" @update:model-value="onCriteriaChange" />
          </UFormField>

          <UFormField label="Ingreso">
            <div class="flex h-10 items-center rounded-lg border border-default px-3 text-sm font-medium">
              {{ form.checkIn }}
            </div>
          </UFormField>

          <UFormField label="Salida">
            <UInput v-model="form.checkOut" type="date" :disabled="stayPreset !== 'custom'" :min="form.checkIn" class="w-full" @update:model-value="onCriteriaChange" />
          </UFormField>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="option in STAY_PRESET_OPTIONS"
            :key="option.value"
            :color="stayPreset === option.value ? 'primary' : 'neutral'"
            :variant="stayPreset === option.value ? 'solid' : 'soft'"
            @click="setStayPreset(option.value)"
          >
            {{ option.label }}
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header><h3 class="font-semibold">Habitaciones disponibles</h3></template>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          {{ form.openEnded ? "Estadia indefinida" : `${nights} noche(s)` }} desde {{ form.checkIn }}.
        </p>

        <div v-for="group in availableRoomGroups" :key="group.name" class="rounded-lg border border-default p-4">
          <span class="font-medium">{{ group.name }}</span>
          <div class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <UButton
              v-for="room in group.rooms"
              :key="room.id"
              color="neutral"
              variant="soft"
              @click="addRoom(room)"
            >
              Hab. {{ room.roomNumber }}
            </UButton>
          </div>
        </div>

        <UAlert
          v-if="!availableRoomGroups.length"
          color="neutral"
          variant="soft"
          icon="i-lucide-info"
          :title="form.branchId ? 'No hay habitaciones disponibles para ese ingreso.' : 'Selecciona una sucursal para cargar habitaciones disponibles.'"
        />

        <div v-if="form.rooms.length" class="space-y-2">
          <div v-for="(room, index) in form.rooms" :key="room.roomId" class="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 md:flex-row md:items-center md:justify-between">
            <div class="flex items-center gap-2">
              <span>Hab. {{ room.roomNumber }} ({{ room.roomTypeName }})</span>
              <UBadge color="neutral" variant="soft">Tarifa: ${{ room.roomPrice.toFixed(2) }}</UBadge>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="removeRoom(index)">Quitar</UButton>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header><h3 class="font-semibold">Huespedes por habitacion</h3></template>
      <div class="space-y-4">
        <div v-for="(room, roomIndex) in form.rooms" :key="room.roomId" class="rounded-lg border border-default p-4">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h4 class="font-medium">Hab. {{ room.roomNumber }}</h4>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ room.roomTypeName }}</p>
            </div>
            <UButton color="primary" variant="soft" icon="i-lucide-user-plus" @click="addCompanion(roomIndex)">
              Agregar acompanante
            </UButton>
          </div>

          <div class="space-y-4">
            <div v-for="(guest, guestIndex) in room.guests" :key="`${room.roomId}-${guestIndex}`" class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
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
                    @click="setMainGuest(roomIndex, guestIndex)"
                  >
                    Marcar principal
                  </UButton>
                </div>

                <UButton
                  v-if="room.guests.length > 1"
                  color="error"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-trash-2"
                  @click="removeGuest(roomIndex, guestIndex)"
                >
                  Quitar
                </UButton>
              </div>

              <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <UInput v-model="guest.fullName" placeholder="Nombre completo" />
                <template v-if="siatBillingEnabled">
                  <USelectMenu
                    v-model="guest.documentType"
                    :items="DOCUMENT_TYPE_OPTIONS"
                    value-key="value"
                    label-key="label"
                    placeholder="Tipo de documento"
                  />
                  <UInput v-model="guest.documentNumber" placeholder="Numero de documento" />
                </template>
                <UInput v-model="guest.birthDate" type="date" />
                <USelectMenu v-model="guest.sex" :items="SEX_OPTIONS" value-key="value" label-key="label" placeholder="Sexo" />
                <UInput v-if="guest.isMainGuest" v-model="guest.phone" placeholder="Celular" />
                <UInput v-if="guest.isMainGuest" v-model="guest.email" type="email" placeholder="Email" />
                <USelectMenu
                  v-model="guest.nationality"
                  :items="NATIONALITY_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Nacionalidad"
                />
                <USelectMenu v-model="guest.maritalStatus" :items="MARITAL_STATUS_OPTIONS" value-key="value" label-key="label" placeholder="Estado civil" />
                <UTextarea v-model="guest.address" :rows="2" placeholder="Procedencia o direccion" class="md:col-span-2 xl:col-span-3" />
              </div>
            </div>
          </div>
        </div>

        <UFormField label="Notas">
          <UTextarea v-model="form.notes" placeholder="Notas opcionales..." class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header><h3 class="font-semibold">Pago</h3></template>
      <div class="space-y-4">
        <UCheckbox v-model="form.registerPaymentNow" label="Registrar pago ahora" />

        <div v-if="form.registerPaymentNow" class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <UFormField label="Monto">
            <UInput v-model="form.paymentAmount" type="number" min="0.01" :max="totalAmount" step="0.01" />
          </UFormField>
          <UFormField label="Metodo">
            <USelectMenu v-model="form.paymentMethod" :items="PAYMENT_METHOD_OPTIONS" value-key="value" label-key="label" />
          </UFormField>
          <UFormField label="Tipo">
            <USelectMenu v-model="form.paymentType" :items="PAYMENT_TYPE_OPTIONS" value-key="value" label-key="label" />
          </UFormField>
          <UFormField label="Referencia">
            <UInput v-model="form.paymentReference" placeholder="Opcional" />
          </UFormField>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-lg border border-default px-4 py-3 text-sm">
          <span>Total estimado</span>
          <span class="font-semibold">${{ totalAmount.toFixed(2) }}</span>
        </div>

        <UCheckbox v-model="form.goToPayment" label="Abrir detalle para cobrar despues" />
      </div>
    </UCard>

    <div class="flex justify-end gap-2">
      <UButton color="neutral" variant="ghost" @click="emit('cancel')">Cancelar</UButton>
      <UButton color="primary" :loading="loading" @click="handleSubmit">
        Registrar ingreso
      </UButton>
    </div>
  </div>
</template>
