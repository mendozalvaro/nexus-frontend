<script setup lang="ts">
import type {
  ReportFilters as ReportFiltersType,
  ReportsFilterOptions,
  ReportsOverviewData,
  SalesReportData,
  ProductsReportData,
  ServicesReportData,
  AppointmentsReportData,
} from "@/composables/useReports";
import type { ReportPeriod } from "@/components/reports/ReportPeriodPresets.vue";

import ReportFilters from "@/components/reports/ReportFilters.vue";
import ReportPeriodPresets from "@/components/reports/ReportPeriodPresets.vue";
import ReportExecutiveDashboard from "@/components/reports/ReportExecutiveDashboard.vue";
import ReportAlertsCard from "@/components/reports/ReportAlertsCard.vue";
import ReportTopSellers from "@/components/reports/ReportTopSellers.vue";
import ReportEmployeeRanking from "@/components/reports/ReportEmployeeRanking.vue";
import ReportPaymentMix from "@/components/reports/ReportPaymentMix.vue";
import ReportReservation from "@/components/reports/ReportReservation.vue";
import { getDefaultPathForRole } from "@/utils/role-access";
import { buildLoginRedirectPath } from "@/utils/redirect";

definePageMeta({
  layout: "default",
  middleware: [],
});

const { profile } = useUserContext();
const { ensureContext } = useUserContext();
const route = useRoute();
const activeBranchId = useState<string | null>("active-branch-id", () => null);
const reportsApi = import.meta.client ? useReports() : null;
const permissionsApi = import.meta.client ? usePermissions() : null;
const businessTypesApi = import.meta.client ? useBusinessTypes() : null;
const subscriptionApi = import.meta.client ? useSubscription() : null;
const clientMounted = ref(false);
const capabilitiesResolved = ref(false);

const createDefaultFilters = (): ReportFiltersType => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const toIsoDate = (value: Date) => value.toISOString().split("T")[0]!;

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    branchIds: activeBranchId.value ? [activeBranchId.value] : [],
    employeeId: null,
    paymentMethod: "all",
    categoryIds: [],
  };
};

const canViewSalesReports = computed(() => permissionsApi?.hasModuleAccess("reports.sales") ?? false);
const canViewServiceReports = computed(() => permissionsApi?.hasModuleAccess("reports.services") ?? false);
const canViewLodgingReports = computed(() => permissionsApi?.hasModuleAccess("reports.lodging") ?? false);
const showOnlyLodgingReports = computed(() =>
  clientMounted.value
  && capabilitiesResolved.value
  && (businessTypesApi?.isOnlyLodging.value ?? false)
  && canViewLodgingReports.value,
);
const showLodgingReports = computed(() => clientMounted.value && canViewLodgingReports.value);

const selectedPeriod = ref<ReportPeriod>("month");
const filters = ref<ReportFiltersType>(createDefaultFilters());

const filterOptions = ref<ReportsFilterOptions>({
  branches: [],
  employees: [],
  productCategories: [],
  serviceCategories: [],
  paymentMethods: [],
});

const overviewData = ref<ReportsOverviewData | null>(null);
const salesData = ref<SalesReportData | null>(null);
const productsData = ref<ProductsReportData | null>(null);
const servicesData = ref<ServicesReportData | null>(null);
const appointmentsData = ref<AppointmentsReportData | null>(null);

const loading = ref(false);

const periodRanges: Record<ReportPeriod, { startDate: string; endDate: string }> = {
  today: {
    startDate: new Date().toISOString().split("T")[0]!,
    endDate: new Date().toISOString().split("T")[0]!,
  },
  week: (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return {
      startDate: start.toISOString().split("T")[0]!,
      endDate: end.toISOString().split("T")[0]!,
    };
  })(),
  month: (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return {
      startDate: start.toISOString().split("T")[0]!,
      endDate: end.toISOString().split("T")[0]!,
    };
  })(),
  quarter: (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 89);
    return {
      startDate: start.toISOString().split("T")[0]!,
      endDate: end.toISOString().split("T")[0]!,
    };
  })(),
  custom: { startDate: "", endDate: "" },
};

const applyPeriod = (period: ReportPeriod) => {
  const range = periodRanges[period];
  if (period !== "custom") {
    filters.value.startDate = range.startDate;
    filters.value.endDate = range.endDate;
  }
};

const loadFilterOptions = async () => {
  if (!import.meta.client) {
    return;
  }

  try {
    const response = await $fetch<{ filterOptions: ReportsFilterOptions }>("/api/reports/filter-support", {
      headers: {
        Authorization: `Bearer ${(await useSessionAccess().resolveAccessToken()) ?? ""}`,
      },
    });
    const fo = response.filterOptions;
    filterOptions.value = {
      branches: fo?.branches ?? [],
      employees: fo?.employees ?? [],
      productCategories: fo?.productCategories ?? [],
      serviceCategories: fo?.serviceCategories ?? [],
      paymentMethods: fo?.paymentMethods ?? [],
    };
  } catch {
    // Fallback to empty options
  }
};

const loadAllReports = async () => {
  if (!reportsApi) {
    return;
  }

  if (businessTypesApi?.isOnlyLodging.value) {
    overviewData.value = null;
    salesData.value = null;
    productsData.value = null;
    servicesData.value = null;
    appointmentsData.value = null;
    return;
  }

  loading.value = true;
  try {
    const [overview, sales, products, services, appointments] = await Promise.all([
      reportsApi.loadOverviewReport(filters.value).catch(() => null),
      canViewSalesReports.value ? reportsApi.loadSalesReport(filters.value).catch(() => null) : Promise.resolve(null),
      canViewSalesReports.value ? reportsApi.loadProductsReport(filters.value).catch(() => null) : Promise.resolve(null),
      canViewServiceReports.value ? reportsApi.loadServicesReport(filters.value).catch(() => null) : Promise.resolve(null),
      canViewServiceReports.value ? reportsApi.loadAppointmentsReport(filters.value).catch(() => null) : Promise.resolve(null),
    ]);
    overviewData.value = overview;
    salesData.value = sales;
    productsData.value = products;
    servicesData.value = services;
    appointmentsData.value = appointments;
  } catch {
    // Silently handle errors
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  await loadAllReports();
};

const resetFilters = () => {
  filters.value = createDefaultFilters();
  selectedPeriod.value = "month";
};

const handleExportCsv = () => {
  const rows: Array<Record<string, string | number>> = [];

  const od = overviewData.value;
  if (od) {
    for (const kpi of od.kpis) {
      rows.push({ Seccion: "KPI", Metrica: kpi.label, Valor: kpi.value, Detalle: kpi.meta ?? "" });
    }
    for (const h of od.topHighlights) {
      rows.push({ Seccion: "Resumen", Metrica: h.label, Valor: h.value, Detalle: h.secondary ?? "" });
    }
  }

  const sd = salesData.value;
  if (sd) {
    for (const tx of sd.transactionsTable) {
      rows.push({ Seccion: "Ventas", ...tx });
    }
  }

  const pd = productsData.value;
  if (pd) {
    for (const p of pd.tableRows) {
      rows.push({ Seccion: "Productos", ...p });
    }
  }

  const svd = servicesData.value;
  if (svd) {
    for (const s of svd.tableRows) {
      rows.push({ Seccion: "Servicios", ...s });
    }
  }

  reportsApi?.downloadCsv(`reporte_${new Date().toISOString().split("T")[0]}.csv`, rows);
};

const handleExportPdf = async (download = false) => {
  const sections: Array<{ heading: string; headers: string[]; rows: Array<Record<string, string | number>> }> = [];

  // KPIs
  const od = overviewData.value;
  if (od) {
    const kpiRows = od.kpis.map((k) => ({
      Indicador: k.label,
      Valor: k.value,
      Detalle: k.meta ?? "",
    }));
    sections.push({ heading: "Indicadores clave", headers: ["Indicador", "Valor", "Detalle"], rows: kpiRows });

    const highlightRows = od.topHighlights.map((h) => ({
      Metrica: h.label,
      Valor: h.value,
      Detalle: h.secondary ?? "",
    }));
    sections.push({ heading: "Resumen del periodo", headers: ["Metrica", "Valor", "Detalle"], rows: highlightRows });
  }

  // Ventas
  const sd = salesData.value;
  if (sd) {
    const txHeaders = ["Fecha", "Ticket", "Empleado", "Sucursal", "Monto", "Metodo", "Estado"];
    const txRows = sd.transactionsTable.map((tx) => ({
      Fecha: tx["Fecha"] ?? "",
      Ticket: tx["Ticket"] ?? "",
      Empleado: tx["Empleado"] ?? "",
      Sucursal: tx["Sucursal"] ?? "",
      Monto: tx["Monto"] ?? "",
      Metodo: tx["Metodo"] ?? "",
      Estado: tx["Estado"] ?? "",
    }));
    sections.push({ heading: "Detalle de ventas", headers: txHeaders, rows: txRows });
  }

  // Top 5 mas vendido
  const pd = productsData.value;
  const svd = servicesData.value;
  const top5: Array<Record<string, string | number>> = [];
  const combined: Array<{ name: string; type: string; qty: number; unit: string }> = [];

  if (pd) {
    for (const p of pd.tableRows) {
      combined.push({ name: String(p["Producto"] ?? ""), type: "producto", qty: Number(p["Cantidad"] ?? 0), unit: "uds" });
    }
  }
  if (svd) {
    for (const s of svd.tableRows) {
      combined.push({ name: String(s["Servicio"] ?? ""), type: "servicio", qty: Number(s["Cantidad"] ?? 0), unit: "veces" });
    }
  }
  combined.sort((a, b) => b.qty - a.qty).slice(0, 5).forEach((item, i) => {
    top5.push({
      "#": i + 1,
      Nombre: item.name,
      Tipo: item.type,
      Vendido: `${item.qty} ${item.unit}`,
    });
  });
  if (top5.length > 0) {
    sections.push({ heading: "Top 5 mas vendido", headers: ["#", "Nombre", "Tipo", "Vendido"], rows: top5 });
  }

  // Ranking empleados
  if (sd) {
    const empMap = new Map<string, { sales: number; services: number }>();
    for (const tx of sd.transactionsTable) {
      const emp = String(tx["Empleado"] ?? "Sin asignar");
      const prev = empMap.get(emp) ?? { sales: 0, services: 0 };
      const monto = parseFloat(String(tx["Monto"] ?? "0").replace(/[^\d.-]/g, ""));
      empMap.set(emp, { sales: prev.sales + (isNaN(monto) ? 0 : monto), services: prev.services });
    }
    if (svd) {
      for (const s of svd.tableRows) {
        const emp = String(s["Empleado"] ?? "Sin asignar");
        const prev = empMap.get(emp) ?? { sales: 0, services: 0 };
        empMap.set(emp, { sales: prev.sales, services: prev.services + Number(s["Cantidad"] ?? 0) });
      }
    }
    const empRows = Array.from(empMap.entries())
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 10)
      .map(([name, data], i) => ({
        "#": i + 1,
        Empleado: name,
        "Ventas (Bs)": data.sales.toFixed(2),
        Servicios: data.services,
      }));
    if (empRows.length > 0) {
      sections.push({ heading: "Ranking por empleado", headers: ["#", "Empleado", "Ventas (Bs)", "Servicios"], rows: empRows });
    }
  }

  // Alertas
  const alerts: Array<Record<string, string | number>> = [];
  if (pd) {
    for (const p of pd.tableRows) {
      const stock = Number(p["Stock actual"] ?? Infinity);
      const min = Number(p["Minimo"] ?? 0);
      if (stock <= min) {
        alerts.push({ Senal: "Stock bajo", Detalle: String(p["Producto"] ?? ""), Estado: `Minimo ${min}`, Urgencia: "Alta" });
      }
    }
  }
  if (alerts.length > 0) {
    sections.push({ heading: "Alertas operativas", headers: ["Senal", "Detalle", "Estado", "Urgencia"], rows: alerts });
  }

  if (download) {
    await reportsApi?.downloadPdf("Reporte Ejecutivo NexusPOS", sections);
  } else {
    reportsApi?.printHtml("Reporte Ejecutivo NexusPOS", sections);
  }
};

const branchHelp = computed(() => {
  if (profile.value?.role === "manager") {
    return `Alcance limitado a tu sucursal asignada`;
  }
  if (filters.value.branchIds.length === 0) {
    return `Todas las sucursales seleccionadas`;
  }
  return `${filters.value.branchIds.length} sucursal(es) seleccionada(s)`;
});

const branchOptions = computed(() => filterOptions.value?.branches ?? []);
const employeeOptions = computed(() => filterOptions.value?.employees ?? []);

onMounted(async () => {
  clientMounted.value = true;
  try {
    const context = await ensureContext({ requireProfile: true, forceUserValidation: true });
    if (!context.user) {
      await navigateTo(buildLoginRedirectPath(route.fullPath), { replace: true });
      return;
    }

    if (!context.profile) {
      await navigateTo(getDefaultPathForRole(null), { replace: true });
      return;
    }

    if (context.profile?.organization_id) {
      await subscriptionApi?.loadCapabilities(context.profile.organization_id, { force: true });
    }

    const accessResolution = await permissionsApi?.resolveRouteAccess({
      moduleKeysAny: ["reports.sales", "reports.services", "reports.lodging"],
      permissionsAny: ["reports.sales.view", "reports.services.view", "reports.lodging.view"],
      roles: ["admin", "manager"],
    });

    if (!accessResolution?.allowed) {
      await navigateTo(getDefaultPathForRole(context.profile.role), { replace: true });
      return;
    }

    capabilitiesResolved.value = true;
    await loadFilterOptions();
    await loadAllReports();
  } catch {
    // Silently handle mount errors
    capabilitiesResolved.value = true;
  }
});

watch(selectedPeriod, (period) => {
  applyPeriod(period);
  if (period !== "custom") {
    loadAllReports();
  }
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UiModuleHero
      eyebrow="Analitica"
      :title="showOnlyLodgingReports ? 'Reportes de hospedaje' : 'Reportes'"
      :description="showOnlyLodgingReports ? 'Vista operativa de ingresos, permanencias y salidas del hospedaje.' : 'Resumen ejecutivo de tu operacion. Selecciona un periodo para ver indicadores y alertas.'"
      icon="i-lucide-bar-chart-3"
    />

    <div v-if="!capabilitiesResolved" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <template v-else-if="showOnlyLodgingReports">
      <ReportReservation />
    </template>

    <template v-else>
      <ReportPeriodPresets v-model="selectedPeriod" @change="applyFilters" />

      <ReportFilters
        v-if="selectedPeriod === 'custom'"
        v-model="filters"
        :branch-options="branchOptions"
        :employee-options="employeeOptions"
        :show-branches="profile?.role === 'admin'"
        :show-employees="true"
        :loading="loading"
        :branch-help="branchHelp"
        @apply="applyFilters"
        @reset="resetFilters"
        @export:csv="handleExportCsv"
        @export:pdf="handleExportPdf"
      />

      <div v-else class="flex justify-end gap-2">
        <UButton color="success" variant="soft" icon="i-lucide-file-spreadsheet" :disabled="loading" @click="handleExportCsv">
          CSV
        </UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-printer" :disabled="loading" @click="handleExportPdf(false)">
          Imprimir
        </UButton>
        <UButton color="primary" variant="soft" icon="i-lucide-download" :disabled="loading" @click="handleExportPdf(true)">
          Descargar PDF
        </UButton>
      </div>

      <ReportExecutiveDashboard
        :overview-data="overviewData"
        :sales-data="canViewSalesReports ? salesData : null"
        :products-data="canViewSalesReports ? productsData : null"
        :services-data="canViewServiceReports ? servicesData : null"
        :loading="loading"
      />

      <div v-if="canViewSalesReports || canViewServiceReports" class="grid gap-6 lg:grid-cols-2">
        <ReportTopSellers
          :products-data="canViewSalesReports ? productsData : null"
          :services-data="canViewServiceReports ? servicesData : null"
        />

        <ReportPaymentMix :overview-data="overviewData" />
      </div>

      <div v-if="canViewSalesReports || canViewServiceReports" class="grid gap-6 lg:grid-cols-2">
        <ReportEmployeeRanking
          :sales-data="canViewSalesReports ? salesData : null"
          :services-data="canViewServiceReports ? servicesData : null"
        />

        <ReportAlertsCard
          :products-data="canViewSalesReports ? productsData : null"
          :appointments-data="canViewServiceReports ? appointmentsData : null"
        />
      </div>

      <ReportReservation v-if="showLodgingReports" />
    </template>
  </div>
</template>
