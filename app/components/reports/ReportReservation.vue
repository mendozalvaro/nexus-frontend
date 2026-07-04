<script setup lang="ts">
type DailyGuestControlRow = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  roomNumber: string;
  time: string;
  date: string;
  age: string;
  maritalStatus: string;
  nationality: string;
  origin: string;
};

type DailyGuestControlReport = {
  reportDate: string;
  organizationName: string;
  organizationAddress: string;
  contactPhone: string;
  checkIns: DailyGuestControlRow[];
  staying: DailyGuestControlRow[];
  checkOuts: DailyGuestControlRow[];
};

const { isFeatureEnabled } = useFeatureFlags();
const showHotel = computed(() => isFeatureEnabled("feature_hotel_module"));
const clientMounted = ref(false);
const shouldRenderHotel = computed(() => clientMounted.value && showHotel.value);

const today = new Date().toISOString().split("T")[0] ?? "";
const selectedDate = ref(today);

const summary = ref<{
  activeReservations: number;
  checkInsToday: number;
  checkOutsToday: number;
  revenueToday: number;
  monthlyRevenue: number;
} | null>(null);

const occupancy = ref<{
  total: number;
  occupied: number;
  available: number;
  maintenance: number;
  cleaning: number;
  occupancyRate: number;
} | null>(null);

const dailyControl = ref<DailyGuestControlReport | null>(null);
const loading = ref(false);
const printing = ref(false);
const error = ref<string | null>(null);

const currencyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const sectionTotals = computed(() => ({
  checkIns: dailyControl.value?.checkIns.length ?? 0,
  staying: dailyControl.value?.staying.length ?? 0,
  checkOuts: dailyControl.value?.checkOuts.length ?? 0,
}));

const fetchWithAuth = async <T>(params: Record<string, string>) => {
  const { resolveAccessToken } = useSessionAccess();
  const token = await resolveAccessToken();
  return await $fetch<T>("/api/hotel/reports", {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
};

const loadData = async () => {
  if (!showHotel.value) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const [summaryData, occupancyData, dailyControlData] = await Promise.all([
      fetchWithAuth<typeof summary.value>({ type: "summary" }),
      fetchWithAuth<typeof occupancy.value>({ type: "occupancy" }),
      fetchWithAuth<DailyGuestControlReport>({ type: "daily-control", date: selectedDate.value }),
    ]);

    summary.value = summaryData;
    occupancy.value = occupancyData;
    dailyControl.value = dailyControlData;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : "Error al cargar reportes.";
  } finally {
    loading.value = false;
  }
};

const buildRowsHtml = (rows: DailyGuestControlRow[]) => {
  if (rows.length === 0) {
    return `<tr><td colspan="10" class="empty">Sin registros</td></tr>`;
  }

  return rows.map((row) => `
    <tr>
      <td>${row.fullName || "&nbsp;"}</td>
      <td>${row.documentType || "&nbsp;"}</td>
      <td>${row.documentNumber || "&nbsp;"}</td>
      <td>${row.roomNumber || "&nbsp;"}</td>
      <td>${row.time || "&nbsp;"}</td>
      <td>${row.date || "&nbsp;"}</td>
      <td>${row.age || "&nbsp;"}</td>
      <td>${row.maritalStatus || "&nbsp;"}</td>
      <td>${row.nationality || "&nbsp;"}</td>
      <td>${row.origin || "&nbsp;"}</td>
    </tr>
  `).join("");
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

const buildPrintHtml = () => {
  const report = dailyControl.value;
  if (!report) {
    return "";
  }

  const title = `Control diario de huesped - ${report.reportDate}`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 18px; color: #000; background: #fff; }
    .sheet { width: 100%; }
    .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
    .meta span { display: inline-block; min-width: 220px; border-bottom: 1px solid #111; padding-bottom: 2px; }
    .title { text-align: center; font-weight: 700; margin: 8px 0 2px; font-size: 24px; text-transform: uppercase; }
    .subtitle { text-align: center; font-weight: 700; margin: 0 0 10px; font-size: 15px; text-transform: uppercase; }
    .org { text-align: center; font-size: 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #111; padding: 4px 5px; font-size: 11px; line-height: 1.15; vertical-align: middle; }
    thead th { text-transform: uppercase; text-align: center; }
    .section-row th { font-size: 14px; padding: 6px; background: #fff; }
    .group-head { background: #fff; }
    .empty { text-align: center; height: 28px; }
    .note { margin-top: 8px; font-size: 10px; color: #333; }
    .w-name { width: 26%; }
    .w-doc-type { width: 7%; }
    .w-doc-number { width: 11%; }
    .w-room { width: 6%; }
    .w-time { width: 11%; }
    .w-date { width: 10%; }
    .w-age { width: 5%; }
    .w-civil { width: 6%; }
    .w-nationality { width: 11%; }
    .w-origin { width: 12%; }
    @media print {
      body { padding: 10px; }
      .sheet { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="meta">
      <div>FECHA: <span>${escapeHtml(report.reportDate)}</span></div>
      <div>CEL: <span>${escapeHtml(report.contactPhone || "")}</span></div>
    </div>
    <div class="title">CONTROL DIARIO DE HUESPED</div>
    <div class="subtitle">${escapeHtml(report.organizationName)}</div>
    <div class="org">${escapeHtml(report.organizationAddress || "")}</div>

    <table>
      <thead>
        <tr class="section-row"><th colspan="10">INGRESO</th></tr>
        <tr>
          <th class="w-name" rowspan="2">Nombres y apellidos</th>
          <th class="group-head" colspan="2">Documento</th>
          <th class="w-room" rowspan="2">Nº de hab.</th>
          <th class="w-time" rowspan="2">Hora</th>
          <th class="w-date" rowspan="2">Fecha</th>
          <th class="w-age" rowspan="2">Edad</th>
          <th class="w-civil" rowspan="2">E. civil</th>
          <th class="w-nationality" rowspan="2">Nacionalidad</th>
          <th class="w-origin" rowspan="2">Procedencia</th>
        </tr>
        <tr>
          <th class="w-doc-type">Tipo</th>
          <th class="w-doc-number">Numero</th>
        </tr>
      </thead>
      <tbody>${buildRowsHtml(report.checkIns)}</tbody>
      <thead>
        <tr class="section-row"><th colspan="10">PERMANENCIA DE HUESPED</th></tr>
      </thead>
      <tbody>${buildRowsHtml(report.staying)}</tbody>
      <thead>
        <tr class="section-row"><th colspan="10">SALIDA DE HUESPED</th></tr>
      </thead>
      <tbody>${buildRowsHtml(report.checkOuts)}</tbody>
    </table>

    <div class="note">
      Nota: ` +
      `hora y estado civil solo se muestran si esos datos existen en el sistema.` +
    `</div>
  </div>
</body>
</html>`;
};

const printDailyControl = () => {
  if (!dailyControl.value || printing.value) {
    return;
  }

  printing.value = true;
  const reportWindow = window.open("", "_blank", "width=1200,height=900");
  if (!reportWindow) {
    printing.value = false;
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(buildPrintHtml());
  reportWindow.document.close();
  reportWindow.onload = () => {
    setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
      printing.value = false;
    }, 300);
  };
};

onMounted(async () => {
  clientMounted.value = true;
  await loadData();
});
watch(selectedDate, async () => {
  await loadData();
});
</script>

<template>
  <div class="space-y-6">
    <template v-if="shouldRenderHotel">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h3 class="text-lg font-semibold">Hospedaje</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Control diario con bloques de ingreso, permanencia y salida.
        </p>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UFormField label="Fecha del control">
          <UInput v-model="selectedDate" type="date" class="min-w-44" />
        </UFormField>
        <UButton color="primary" variant="soft" icon="i-lucide-printer" :loading="printing || loading" @click="printDailyControl">
          Imprimir control diario
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-x" :title="error" />

    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <template v-if="summary && !loading">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <UiStatCard label="Estadias activas" :value="summary.activeReservations" icon="i-lucide-calendar-check" icon-class="text-sky-600" icon-wrapper-class="bg-sky-100" />
        <UiStatCard label="Check-ins hoy" :value="summary.checkInsToday" icon="i-lucide-log-in" icon-class="text-emerald-600" icon-wrapper-class="bg-emerald-100" />
        <UiStatCard label="Check-outs hoy" :value="summary.checkOutsToday" icon="i-lucide-log-out" icon-class="text-amber-600" icon-wrapper-class="bg-amber-100" />
        <UiStatCard label="Ingresos hoy" :value="currencyFormatter.format(summary.revenueToday)" icon="i-lucide-trending-up" icon-class="text-violet-600" icon-wrapper-class="bg-violet-100" />
        <UiStatCard label="Ingresos del mes" :value="currencyFormatter.format(summary.monthlyRevenue)" icon="i-lucide-calendar" icon-class="text-primary-600" icon-wrapper-class="bg-primary-100" />
      </div>
    </template>

    <template v-if="occupancy && !loading">
      <UCard>
        <template #header><h3 class="font-semibold">Ocupación actual</h3></template>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-primary-600">{{ occupancy.occupancyRate }}%</div>
            <div class="text-sm text-slate-500">Ocupación</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-emerald-600">{{ occupancy.available }}</div>
            <div class="text-sm text-slate-500">Disponibles</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-amber-600">{{ occupancy.occupied }}</div>
            <div class="text-sm text-slate-500">Ocupadas</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-slate-600">{{ occupancy.maintenance + occupancy.cleaning }}</div>
            <div class="text-sm text-slate-500">Manto/Limpieza</div>
          </div>
        </div>
      </UCard>
    </template>

    <UCard v-if="dailyControl && !loading" class="overflow-hidden">
      <template #header>
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="font-semibold">Control diario de huésped</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Fecha {{ dailyControl.reportDate }} · Cel {{ dailyControl.contactPhone || "s/d" }}
            </p>
          </div>
          <div class="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Ingresos: {{ sectionTotals.checkIns }}</span>
            <span>Permanencia: {{ sectionTotals.staying }}</span>
            <span>Salidas: {{ sectionTotals.checkOuts }}</span>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div class="text-center">
            <p class="text-lg font-semibold uppercase tracking-wide">Control diario de huésped</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ dailyControl.organizationName }}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500">{{ dailyControl.organizationAddress || "Sin dirección registrada" }}</p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-[1080px] w-full border-collapse text-sm">
            <thead>
              <tr class="bg-slate-100 text-center dark:bg-slate-900">
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Nombres y apellidos</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" colspan="2">Documento</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Nº de hab.</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Hora</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Fecha</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Edad</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">E. civil</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Nacionalidad</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700" rowspan="2">Procedencia</th>
              </tr>
              <tr class="bg-slate-100 text-center dark:bg-slate-900">
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700">Tipo</th>
                <th class="border border-slate-300 px-2 py-2 font-semibold dark:border-slate-700">Número</th>
              </tr>
            </thead>
            <tbody>
              <tr class="bg-slate-50 dark:bg-slate-950/40">
                <td colspan="10" class="border border-slate-300 px-2 py-2 text-center font-semibold dark:border-slate-700">INGRESO</td>
              </tr>
              <tr v-for="(row, index) in dailyControl.checkIns" :key="`checkin-${index}`">
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.fullName || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.documentType || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.documentNumber || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.roomNumber || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.time || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.date || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.age || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.maritalStatus || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.nationality || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.origin || "—" }}</td>
              </tr>
              <tr v-if="dailyControl.checkIns.length === 0">
                <td colspan="10" class="border border-slate-200 px-2 py-3 text-center text-slate-500 dark:border-slate-800">Sin ingresos para la fecha seleccionada.</td>
              </tr>

              <tr class="bg-slate-50 dark:bg-slate-950/40">
                <td colspan="10" class="border border-slate-300 px-2 py-2 text-center font-semibold dark:border-slate-700">PERMANENCIA DE HUESPED</td>
              </tr>
              <tr v-for="(row, index) in dailyControl.staying" :key="`staying-${index}`">
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.fullName || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.documentType || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.documentNumber || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.roomNumber || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.time || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.date || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.age || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.maritalStatus || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.nationality || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.origin || "—" }}</td>
              </tr>
              <tr v-if="dailyControl.staying.length === 0">
                <td colspan="10" class="border border-slate-200 px-2 py-3 text-center text-slate-500 dark:border-slate-800">Sin huéspedes en permanencia para la fecha seleccionada.</td>
              </tr>

              <tr class="bg-slate-50 dark:bg-slate-950/40">
                <td colspan="10" class="border border-slate-300 px-2 py-2 text-center font-semibold dark:border-slate-700">SALIDA DE HUESPED</td>
              </tr>
              <tr v-for="(row, index) in dailyControl.checkOuts" :key="`checkout-${index}`">
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.fullName || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.documentType || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.documentNumber || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.roomNumber || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.time || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.date || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.age || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.maritalStatus || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.nationality || "—" }}</td>
                <td class="border border-slate-200 px-2 py-2 dark:border-slate-800">{{ row.origin || "—" }}</td>
              </tr>
              <tr v-if="dailyControl.checkOuts.length === 0">
                <td colspan="10" class="border border-slate-200 px-2 py-3 text-center text-slate-500 dark:border-slate-800">Sin salidas para la fecha seleccionada.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400">
          `Hora` y `E. civil` solo se completan si esos datos existen en la reserva; actualmente `Edad`, `Nacionalidad` y `Procedencia` salen desde `birth_date`, `nationality` y `address`.
        </p>
      </div>
    </UCard>
    </template>
  </div>
</template>

