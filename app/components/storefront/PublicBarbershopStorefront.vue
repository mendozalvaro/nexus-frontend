<script setup lang="ts">
import StorefrontHead from "@/components/storefront/StorefrontHead.vue";
import StorefrontLoginModal from "@/components/client/StorefrontLoginModal.vue";
import type {
  PublicBookingCatalogResponse,
  PublicBookingClientLinkPayload,
  PublicBookingClientProfile,
  PublicBookingCreateResponse,
  PublicBookingEmployee,
  PublicBookingSlot,
} from "@/types/public-booking";
import type { PublicStorefrontResponse } from "@/types/storefront";

const props = defineProps<{
  storefront: PublicStorefrontResponse;
  slug: string;
}>();

const { loadCatalogBySlug, loadAvailabilityBySlug, loadClientProfileBySlug, linkClientProfileBySlug, createBookingBySlug } = usePublicBookings();
const { user, profile, resolvedRole } = useAuth();

const currencyFormatter = computed(() => new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: props.storefront.organization.currencyCode ?? "BOB",
  minimumFractionDigits: 2,
}));

const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/barbers.shapa.2025" },
  { label: "TikTok", href: "https://www.tiktok.com/@cobija_pando_bolvia" },
];

const staffCards = [
  {
    name: "Ariel Fade",
    role: "Barbero senior",
    copy: "Cortes clasicos, fades limpios y perfilado de barba con precision.",
  },
  {
    name: "Mateo Studio",
    role: "Barbero de estilo",
    copy: "Looks modernos, cambios de imagen y acabados listos para evento.",
  },
  {
    name: "Kevin Blend",
    role: "Barbero express",
    copy: "Atencion agil para mantenimiento, peinado y barba en horario comercial.",
  },
  {
    name: "Nadia Care",
    role: "Especialista en tratamientos",
    copy: "Hidratacion capilar, spa capilar premium y limpieza facial express.",
  },
];

const benefits = [
  "Reserva real por horario y profesional.",
  "Barberia, peluqueria y tratamientos en un solo lugar.",
  "Atencion unisex con enfoque en imagen y cuidado personal.",
  "Ubicacion central en Cobija frente a Casa Santa Elena.",
];

const bookingCatalog = ref<PublicBookingCatalogResponse | null>(null);
const bookingError = ref("");
const bookingLoading = ref(true);
const slotsLoading = ref(false);
const submitError = ref("");
const successState = ref<PublicBookingCreateResponse | null>(null);
const slots = ref<PublicBookingSlot[]>([]);
const clientProfileLoading = ref(false);
const showLoginModal = ref(false);
const isLinkingClient = ref(false);

const form = reactive({
  branchId: "",
  serviceId: "",
  employeeId: "",
  date: "",
  startTimeLocal: "",
  fullName: "",
  phone: "",
  email: "",
  notes: "",
});

const clientLinkForm = reactive<PublicBookingClientLinkPayload>({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
});

const isSubmitting = ref(false);
const linkedClientProfile = ref<PublicBookingClientProfile | null>(null);

const heroStyle = {
  background: "radial-gradient(circle at top left, rgba(217,75,90,0.30), transparent 35%), linear-gradient(135deg, #090909 0%, #161616 55%, #221518 100%)",
};

const accentStyle = computed(() => ({
  color: props.storefront.settings.accentColor,
}));

const cardBorder = computed(() => ({
  borderColor: "rgba(255,255,255,0.08)",
}));

const selectedService = computed(() =>
  bookingCatalog.value?.services.find((service) => service.id === form.serviceId) ?? null,
);

const selectedEmployee = computed(() =>
  bookingCatalog.value?.employees.find((employee) => employee.id === form.employeeId) ?? null,
);

const availableEmployees = computed(() => {
  if (!bookingCatalog.value || !form.branchId || !form.serviceId) {
    return [] as PublicBookingEmployee[];
  }

  return bookingCatalog.value.employees.filter((employee) => {
    if (!employee.assignedBranchIds.includes(form.branchId)) {
      return false;
    }

    const serviceIds = employee.serviceIdsByBranch[form.branchId] ?? [];
    return serviceIds.includes(form.serviceId);
  });
});

const formattedSuccessTime = computed(() => {
  if (!successState.value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(successState.value.startTime));
});

const hasClientSession = computed(() => (
  Boolean(user.value)
  && (
    resolvedRole.value === "client"
    || linkedClientProfile.value?.orgStatus === "active"
  )
));

const isLinkedClient = computed(() => (
  hasClientSession.value
  && linkedClientProfile.value?.orgStatus === "active"
));

const requiresAuthToBook = computed(() => !hasClientSession.value);

const linkedClientName = computed(() => {
  const clientProfile = linkedClientProfile.value;
  if (!clientProfile) {
    return profile.value?.full_name ?? user.value?.email ?? "";
  }

  return clientProfile.fullName;
});

const linkedClientEmail = computed(() => linkedClientProfile.value?.email ?? user.value?.email ?? "");
const hasStaffSession = computed(() => Boolean(resolvedRole.value) && resolvedRole.value !== "client");
const requiresClientLink = computed(() => (
  Boolean(user.value)
  && !clientProfileLoading.value
  && !linkedClientProfile.value
  && !hasStaffSession.value
));
const hasInactiveClientLink = computed(() => (
  hasStaffSession.value
  || (Boolean(linkedClientProfile.value) && linkedClientProfile.value?.orgStatus !== "active")
));

const canQuerySlots = computed(() => (
  Boolean(form.branchId)
  && Boolean(form.serviceId)
  && Boolean(form.employeeId)
  && Boolean(form.date)
));

const availableSlotCount = computed(() => slots.value.filter((slot) => slot.available).length);

const scrollToBooking = () => {
  document.querySelector("#booking-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const loadCatalog = async () => {
  bookingLoading.value = true;
  bookingError.value = "";

  try {
    bookingCatalog.value = await loadCatalogBySlug(props.slug);
    form.branchId = bookingCatalog.value.branches[0]?.id ?? "";
  } catch (error) {
    bookingError.value = error instanceof Error ? error.message : "No se pudo cargar el modulo de reservas.";
  } finally {
    bookingLoading.value = false;
  }
};

const loadLinkedClientProfile = async () => {
  if (!user.value) {
    linkedClientProfile.value = null;
    return;
  }

  clientProfileLoading.value = true;
  try {
    linkedClientProfile.value = await loadClientProfileBySlug(props.slug);
  } finally {
    clientProfileLoading.value = false;
  }
};

const prefillClientLinkForm = () => {
  const fullName = profile.value?.full_name?.trim() || user.value?.email?.split("@")[0]?.trim() || "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  clientLinkForm.firstName = parts.shift() ?? "";
  clientLinkForm.lastName = parts.join(" ");
  clientLinkForm.phone = "";
  clientLinkForm.email = user.value?.email ?? "";
};

const submitClientLink = async () => {
  submitError.value = "";

  if (!clientLinkForm.firstName?.trim()) {
    submitError.value = "El nombre es obligatorio.";
    return;
  }

  if (!clientLinkForm.phone?.trim() && !clientLinkForm.email?.trim()) {
    submitError.value = "Debes enviar al menos telefono o correo.";
    return;
  }

  isLinkingClient.value = true;
  try {
    linkedClientProfile.value = await linkClientProfileBySlug(props.slug, {
      firstName: clientLinkForm.firstName.trim(),
      lastName: clientLinkForm.lastName?.trim() || null,
      phone: clientLinkForm.phone?.trim() || null,
      email: clientLinkForm.email?.trim() || null,
      preferences: { booking_channel: "storefront" },
      billingData: { source: "public_storefront_auth" },
    });
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : "No se pudo vincular tu perfil.";
  } finally {
    isLinkingClient.value = false;
  }
};

const loadSlots = async () => {
  if (!canQuerySlots.value) {
    slots.value = [];
    form.startTimeLocal = "";
    return;
  }

  slotsLoading.value = true;
  submitError.value = "";

  try {
    const response = await loadAvailabilityBySlug(props.slug, {
      branchId: form.branchId,
      serviceId: form.serviceId,
      employeeId: form.employeeId,
      date: form.date,
    });
    slots.value = response.slots;

    if (!slots.value.some((slot) => slot.value === form.startTimeLocal && slot.available)) {
      form.startTimeLocal = slots.value.find((slot) => slot.available)?.value ?? "";
    }
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : "No se pudo consultar disponibilidad.";
    slots.value = [];
    form.startTimeLocal = "";
  } finally {
    slotsLoading.value = false;
  }
};

watch(availableEmployees, (employees) => {
  if (!employees.some((employee) => employee.id === form.employeeId)) {
    form.employeeId = employees[0]?.id ?? "";
  }
});

watch(() => form.serviceId, () => {
  successState.value = null;
});

watch(
  () => [form.branchId, form.serviceId, form.employeeId, form.date].join("|"),
  async () => {
    await loadSlots();
  },
);

onMounted(async () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  form.date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  prefillClientLinkForm();
  await loadLinkedClientProfile();
  await loadCatalog();
});

watch(() => user.value?.id ?? null, async () => {
  prefillClientLinkForm();
  await loadLinkedClientProfile();
});

const handleLoginSuccess = async () => {
  showLoginModal.value = false;
  await loadLinkedClientProfile();
  await loadSlots();
};

const submitBooking = async () => {
  submitError.value = "";
  successState.value = null;

  if (requiresAuthToBook.value) {
    showLoginModal.value = true;
    return;
  }

  if (!form.startTimeLocal) {
    submitError.value = "Selecciona un horario disponible.";
    return;
  }

  isSubmitting.value = true;

  try {
    successState.value = await createBookingBySlug(props.slug, {
      branchId: form.branchId,
      serviceId: form.serviceId,
      employeeId: form.employeeId,
      date: form.date,
      startTimeLocal: form.startTimeLocal,
      fullName: null,
      phone: null,
      email: null,
      notes: form.notes || null,
    });
    form.notes = "";
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : "No se pudo registrar tu reserva.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#070707] text-[#F4EDE1]">
    <StorefrontHead
      :storefront="storefront"
      :slug="slug"
      :is-client-ready="isLinkedClient"
      :customer-name="linkedClientName"
    />

    <main>
      <section class="relative overflow-hidden border-b border-white/10" :style="heroStyle">
        <div class="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
          <div class="space-y-8">
            <div class="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.32em] text-[#D94B5A]">
              Neo Barbershop / Cobija
            </div>

            <div class="space-y-6">
              <img
                src="/brands/shapa-barber-logo.svg"
                alt="Barbers Shapa"
                class="h-20 w-20 rounded-3xl border border-white/10 bg-[#F4EDE1] p-2 shadow-2xl shadow-black/30"
              />
              <div class="space-y-4">
                <p class="text-sm uppercase tracking-[0.28em] text-white/60">Spa unisex</p>
                <h1 class="max-w-3xl font-['Bodoni_Moda',serif] text-5xl leading-none text-white sm:text-6xl lg:text-7xl">
                  Tu imagen empieza aqui.
                </h1>
                <p class="max-w-2xl text-base leading-8 text-[#F4EDE1]/78 sm:text-lg">
                  Cortes, barberia, peluqueria y tratamientos en un espacio unisex pensado para salir impecable.
                  Reserva horario real con tu profesional en Barbers Shapa.
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                class="rounded-full bg-[#D94B5A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#e45d6c]"
                @click="scrollToBooking"
              >
                Reservar ahora
              </button>
              <a
                href="#services-section"
                class="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver servicios
              </a>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-3xl border bg-white/5 p-4 backdrop-blur" :style="cardBorder">
                <p class="text-xs uppercase tracking-[0.22em] text-white/45">Horario</p>
                <p class="mt-2 text-lg font-semibold text-white">Lun-Sab 09:00-20:00</p>
              </div>
              <div class="rounded-3xl border bg-white/5 p-4 backdrop-blur" :style="cardBorder">
                <p class="text-xs uppercase tracking-[0.22em] text-white/45">Equipo</p>
                <p class="mt-2 text-lg font-semibold text-white">3 barberos + 1 especialista</p>
              </div>
              <div class="rounded-3xl border bg-white/5 p-4 backdrop-blur" :style="cardBorder">
                <p class="text-xs uppercase tracking-[0.22em] text-white/45">Contacto</p>
                <p class="mt-2 text-lg font-semibold text-white">67231750</p>
              </div>
              <div class="rounded-3xl border bg-white/5 p-4 backdrop-blur" :style="cardBorder">
                <p class="text-xs uppercase tracking-[0.22em] text-white/45">Ubicacion</p>
                <p class="mt-2 text-lg font-semibold text-white">Frente a Casa Santa Elena</p>
              </div>
            </div>
          </div>

          <aside class="rounded-[2rem] border border-white/10 bg-[#111111]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <p class="text-xs uppercase tracking-[0.26em] text-[#D94B5A]">Reserva directa</p>
            <h2 class="mt-4 font-['Bodoni_Moda',serif] text-3xl text-white">Agenda tu servicio</h2>
            <p class="mt-3 text-sm leading-7 text-[#F4EDE1]/70">
              Elige servicio, profesional y horario. La cita queda registrada en la agenda real del tenant.
            </p>

            <div class="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
              <p class="text-xs uppercase tracking-[0.22em] text-white/45">Direccion</p>
              <p class="mt-2 text-sm leading-7 text-[#F4EDE1]/78">
                Visitanos en Av. Teniente Coronel Cornejo, ciudad de Cobija, frente a Casa Santa Elena.
              </p>
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <a
                :href="`https://wa.me/${(storefront.organization.whatsapp ?? storefront.organization.phone ?? '67231750').replace(/\D/g, '')}`"
                target="_blank"
                class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                WhatsApp
              </a>
              <a
                v-for="social in socialLinks"
                :key="social.label"
                :href="social.href"
                target="_blank"
                class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                {{ social.label }}
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section id="services-section" class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div class="space-y-3">
            <p class="text-xs uppercase tracking-[0.3em]" :style="accentStyle">Servicios</p>
            <h2 class="font-['Bodoni_Moda',serif] text-4xl text-white">Peluqueria, barberia y tratamientos</h2>
            <p class="max-w-3xl text-sm leading-7 text-[#F4EDE1]/70">
              Un catalogo orientado a servicio real: tiempos definidos, precios claros y personal asignado.
            </p>
          </div>
          <p class="text-sm text-[#F4EDE1]/55">{{ storefront.items.length }} servicios publicados</p>
        </div>

        <div class="mt-8 grid gap-5 lg:grid-cols-2">
          <article
            v-for="item in storefront.items"
            :key="item.id"
            class="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] shadow-xl shadow-black/20"
          >
            <div class="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
              <div class="min-h-56 bg-[#1A1A1A]">
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.title"
                  class="h-full w-full object-cover"
                />
                <div v-else class="flex h-full items-center justify-center bg-gradient-to-br from-[#D94B5A]/20 to-transparent text-center text-sm text-[#F4EDE1]/45">
                  Imagen del servicio
                </div>
              </div>
              <div class="flex flex-col justify-between p-6">
                <div>
                  <div class="flex flex-wrap items-center gap-3">
                    <span v-if="item.badge" class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#F4EDE1]/60">
                      {{ item.badge }}
                    </span>
                    <span class="text-xs uppercase tracking-[0.2em] text-[#D94B5A]">
                      {{ item.meta }}
                    </span>
                  </div>
                  <h3 class="mt-4 text-2xl font-semibold text-white">{{ item.title }}</h3>
                  <p class="mt-3 text-sm leading-7 text-[#F4EDE1]/70">{{ item.description }}</p>
                </div>
                <div class="mt-6 flex items-center justify-between gap-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-[#F4EDE1]/45">Precio referencial</p>
                    <p class="mt-2 text-2xl font-semibold text-white">{{ currencyFormatter.format(item.price ?? 0) }}</p>
                  </div>
                  <button
                    class="rounded-full bg-[#F4EDE1] px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-white"
                    @click="form.serviceId = item.id; scrollToBooking()"
                  >
                    Reservar
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="border-y border-white/10 bg-[#0E0E0E]">
        <div class="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p class="text-xs uppercase tracking-[0.3em]" :style="accentStyle">Experiencia</p>
            <h2 class="mt-4 font-['Bodoni_Moda',serif] text-4xl text-white">Un espacio unisex pensado para repetir.</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div
              v-for="benefit in benefits"
              :key="benefit"
              class="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-[#F4EDE1]/75"
            >
              {{ benefit }}
            </div>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div class="space-y-3">
          <p class="text-xs uppercase tracking-[0.3em]" :style="accentStyle">Staff</p>
          <h2 class="font-['Bodoni_Moda',serif] text-4xl text-white">Equipo demo para agenda y reservas</h2>
        </div>

        <div class="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="member in staffCards"
            :key="member.name"
            class="rounded-[1.75rem] border border-white/10 bg-[#111111] p-6"
          >
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D94B5A]/12 text-lg font-semibold text-[#D94B5A]">
              {{ member.name.charAt(0) }}
            </div>
            <p class="mt-5 text-xs uppercase tracking-[0.22em] text-[#F4EDE1]/45">{{ member.role }}</p>
            <h3 class="mt-3 text-xl font-semibold text-white">{{ member.name }}</h3>
            <p class="mt-3 text-sm leading-7 text-[#F4EDE1]/70">{{ member.copy }}</p>
          </article>
        </div>
      </section>

      <section id="booking-section" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div class="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div class="rounded-[2rem] border border-white/10 bg-[#101010] p-6">
            <p class="text-xs uppercase tracking-[0.3em]" :style="accentStyle">Reservas completas</p>
            <h2 class="mt-4 font-['Bodoni_Moda',serif] text-4xl text-white">Crea una cita real</h2>
            <p class="mt-4 text-sm leading-7 text-[#F4EDE1]/70">
              El formulario crea una cita con estado pendiente en el modulo de agenda. No deje pagos online por ahora.
            </p>

            <div class="mt-8 space-y-4 rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
              <div v-if="selectedService" class="space-y-2">
                <p class="text-xs uppercase tracking-[0.2em] text-[#F4EDE1]/45">Servicio seleccionado</p>
                <p class="text-xl font-semibold text-white">{{ selectedService.name }}</p>
                <p class="text-sm text-[#F4EDE1]/65">
                  {{ selectedService.durationMinutes }} min / {{ currencyFormatter.format(selectedService.price) }}
                </p>
              </div>

              <div v-if="selectedEmployee" class="space-y-2">
                <p class="text-xs uppercase tracking-[0.2em] text-[#F4EDE1]/45">Profesional</p>
                <p class="text-xl font-semibold text-white">{{ selectedEmployee.fullName }}</p>
                <p class="text-sm text-[#F4EDE1]/65">{{ selectedEmployee.role }}</p>
              </div>

              <div class="space-y-2">
                <p class="text-xs uppercase tracking-[0.2em] text-[#F4EDE1]/45">Disponibilidad</p>
                <p class="text-xl font-semibold text-white">
                  <template v-if="slotsLoading">Consultando horarios...</template>
                  <template v-else>{{ availableSlotCount }} horarios libres</template>
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-[2rem] border border-white/10 bg-[#F4EDE1] p-6 text-[#111111] shadow-2xl shadow-black/20">
            <div v-if="bookingLoading" class="rounded-[1.5rem] bg-white px-5 py-10 text-center text-sm text-slate-500">
              Cargando catalogo de reservas...
            </div>

            <div v-else-if="bookingError" class="rounded-[1.5rem] bg-white px-5 py-10 text-center text-sm text-red-600">
              {{ bookingError }}
            </div>

            <div
              v-else-if="!user"
              class="space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Acceso requerido</p>
              <h3 class="text-2xl font-semibold text-slate-900">Inicia sesion o registrate para agendar</h3>
              <p class="text-sm leading-7 text-slate-600">
                La agenda de Barbers Shapa solo acepta reservas de clientes autenticados.
              </p>
              <div class="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  class="rounded-full bg-[#111111] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
                  @click="showLoginModal = true"
                >
                  Ingresar o crear cuenta
                </button>
              </div>
            </div>

            <div
              v-else-if="clientProfileLoading"
              class="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500"
            >
              Preparando tu perfil de cliente...
            </div>

            <form
              v-else-if="requiresClientLink"
              class="space-y-5 rounded-[1.5rem] border border-slate-200 bg-white p-6"
              @submit.prevent="submitClientLink"
            >
              <div class="space-y-2 text-center">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Completa tu perfil</p>
                <h3 class="text-2xl font-semibold text-slate-900">Vincula tu cuenta como cliente</h3>
                <p class="text-sm leading-7 text-slate-600">
                  Solo necesitamos tus datos base para habilitar reservas en esta tienda.
                </p>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nombre</span>
                  <input v-model="clientLinkForm.firstName" type="text" required class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]" />
                </label>
                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Apellido</span>
                  <input v-model="clientLinkForm.lastName" type="text" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]" />
                </label>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Telefono</span>
                  <input v-model="clientLinkForm.phone" type="tel" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]" />
                </label>
                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Correo</span>
                  <input v-model="clientLinkForm.email" type="email" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]" />
                </label>
              </div>

              <button
                type="submit"
                class="w-full rounded-full bg-[#111111] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isLinkingClient"
              >
                {{ isLinkingClient ? "Vinculando..." : "Continuar como cliente" }}
              </button>
            </form>

            <div
              v-else-if="hasInactiveClientLink"
              class="space-y-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-6 text-center"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Cuenta sin acceso</p>
              <h3 class="text-2xl font-semibold text-slate-900">Tu cuenta no puede reservar en esta tienda</h3>
              <p class="text-sm leading-7 text-slate-700">
                Esta cuenta ya existe, pero no tiene un perfil cliente activo para este tenant.
              </p>
            </div>

            <form v-else class="space-y-5" @submit.prevent="submitBooking">
              <div v-if="successState" class="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Reserva registrada para {{ successState.customerName }}.
                {{ successState.serviceName }} con {{ successState.employeeName }} el {{ formattedSuccessTime }}.
              </div>

              <div v-if="submitError" class="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {{ submitError }}
              </div>
              <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                Reservando como <strong>{{ linkedClientName }}</strong>
                <span v-if="linkedClientEmail"> / {{ linkedClientEmail }}</span>
                <span v-if="linkedClientProfile?.phone"> / {{ linkedClientProfile.phone }}</span>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fecha</span>
                  <input
                    v-model="form.date"
                    type="date"
                    required
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]"
                  />
                </label>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sucursal</span>
                  <select
                    v-model="form.branchId"
                    required
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]"
                  >
                    <option value="" disabled>Selecciona</option>
                    <option
                      v-for="branch in bookingCatalog?.branches ?? []"
                      :key="branch.id"
                      :value="branch.id"
                    >
                      {{ branch.name }}
                    </option>
                  </select>
                </label>

                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Servicio</span>
                  <select
                    v-model="form.serviceId"
                    required
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]"
                  >
                    <option value="" disabled>Selecciona</option>
                    <option
                      v-for="service in bookingCatalog?.services ?? []"
                      :key="service.id"
                      :value="service.id"
                    >
                      {{ service.name }}
                    </option>
                  </select>
                </label>

                <label class="space-y-2">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profesional</span>
                  <select
                    v-model="form.employeeId"
                    required
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]"
                  >
                    <option value="" disabled>Selecciona</option>
                    <option
                      v-for="employee in availableEmployees"
                      :key="employee.id"
                      :value="employee.id"
                    >
                      {{ employee.fullName }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between gap-4">
                  <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Horarios disponibles</span>
                  <span class="text-xs text-slate-500">{{ slotsLoading ? "Actualizando..." : `${availableSlotCount} libres` }}</span>
                </div>

                <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <button
                    v-for="slot in slots"
                    :key="slot.value"
                    type="button"
                    class="rounded-2xl border px-3 py-3 text-sm font-semibold transition"
                    :class="[
                      slot.available
                        ? form.startTimeLocal === slot.value
                          ? 'border-[#D94B5A] bg-[#D94B5A] text-white'
                          : 'border-slate-200 bg-white text-slate-900 hover:border-[#D94B5A]'
                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    ]"
                    :disabled="!slot.available"
                    @click="form.startTimeLocal = slot.value"
                  >
                    {{ slot.label }}
                  </button>
                </div>
              </div>

              <label class="space-y-2">
                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Notas</span>
                <textarea
                  v-model="form.notes"
                  rows="4"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#D94B5A]"
                  placeholder="Referencia, preferencia o detalle adicional"
                />
              </label>

              <div class="flex flex-wrap items-center justify-between gap-4">
                <p class="text-xs leading-6 text-slate-500">
                  Al reservar, la cita se registra con estado pendiente para confirmacion interna.
                </p>
                <button
                  type="submit"
                  class="rounded-full bg-[#111111] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isSubmitting || !form.startTimeLocal"
                >
                  {{ isSubmitting ? "Registrando..." : "Confirmar reserva" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <footer class="border-t border-white/10 bg-black/20">
        <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-[#F4EDE1]/60 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p class="font-semibold text-white">Barbers Shapa</p>
            <p>Av. Teniente Coronel Cornejo, Cobija, frente a Casa Santa Elena.</p>
          </div>
          <div class="flex flex-wrap gap-4">
            <a class="transition hover:text-white" href="tel:67231750">67231750</a>
            <a
              v-for="social in socialLinks"
              :key="social.label"
              :href="social.href"
              target="_blank"
              class="transition hover:text-white"
            >
              {{ social.label }}
            </a>
          </div>
        </div>
      </footer>
    </main>

    <StorefrontLoginModal
      :open="showLoginModal"
      :slug="slug"
      :primary-color="storefront.settings.primaryColor"
      :business-name="storefront.organization.name"
      @close="showLoginModal = false"
      @login-success="handleLoginSuccess"
    />
  </div>
</template>
