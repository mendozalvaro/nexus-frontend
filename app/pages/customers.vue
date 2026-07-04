<script setup lang="ts">
import CustomersTabs from "@/components/customers/CustomersTabs.vue";
import CustomersTable from "@/components/customers/CustomersTable.vue";
import CustomerFormModal from "@/components/customers/modals/CustomerFormModal.vue";
import CustomerMergeModal from "@/components/customers/modals/CustomerMergeModal.vue";
import type { CustomerRow, CustomersFilters, CustomersSummary } from "@/composables/useCustomers";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "clients.view",
  moduleKey: "clients",
  roles: ["admin", "manager"],
});

const {
  statusOptions,
  getDefaultFilters,
  loadCustomers,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  mergeCustomers,
} = useCustomers();

const filters = reactive<CustomersFilters>(getDefaultFilters());
const page = ref(1);
const perPage = 20;
const activeTab = ref<"summary" | "customers">("summary");
const loading = ref(false);
const rows = ref<CustomerRow[]>([]);
const total = ref(0);
const summary = ref<CustomersSummary>({
  total: 0,
  active: 0,
  blocked: 0,
  inactive: 0,
  anonymousTemplates: 0,
});
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const formOpen = ref(false);
const editingCustomer = ref<CustomerRow | null>(null);
const mutationLoading = ref(false);

const mergeOpen = ref(false);
const mergeSource = ref<CustomerRow | null>(null);

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / perPage)));
const summaryText = computed(() => `Página ${page.value} de ${pageCount.value} · ${total.value} cliente(s)`);

const mergeCandidates = computed(() =>
  rows.value.filter((row) =>
    !row.isAnonymousTemplate
    && row.clientId !== mergeSource.value?.clientId
    && row.status !== "blocked",
  ),
);

const statusFilterOptions = computed(() =>
  statusOptions.map((option) => ({ label: option.label, value: option.value })),
);

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await loadCustomers({ page: page.value, perPage, filters });
    rows.value = response.rows ?? [];
    total.value = Number(response.total ?? 0);
    summary.value = response.summary ?? {
      total: 0,
      active: 0,
      blocked: 0,
      inactive: 0,
      anonymousTemplates: 0,
    };
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : "No se pudo cargar clientes.";
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  if (page.value !== 1) {
    page.value = 1;
    return;
  }

  await load();
};

const clearFilters = async () => {
  Object.assign(filters, getDefaultFilters());
  if (page.value !== 1) {
    page.value = 1;
    return;
  }

  await load();
};

const openCreate = () => {
  editingCustomer.value = null;
  formOpen.value = true;
};

const openEdit = (row: CustomerRow) => {
  editingCustomer.value = row;
  formOpen.value = true;
};

const handleSave = async (payload: Parameters<typeof createCustomer>[0]) => {
  mutationLoading.value = true;
  error.value = null;
  success.value = null;
  try {
    if (editingCustomer.value) {
      await updateCustomer(editingCustomer.value.clientId, payload);
      success.value = "Cliente actualizado correctamente.";
    } else {
      await createCustomer(payload);
      success.value = "Cliente creado correctamente.";
    }

    formOpen.value = false;
    editingCustomer.value = null;
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : "No se pudo guardar el cliente.";
  } finally {
    mutationLoading.value = false;
  }
};

const handleSetStatus = async (row: CustomerRow, status: "active" | "inactive" | "blocked") => {
  mutationLoading.value = true;
  error.value = null;
  success.value = null;
  try {
    await setCustomerStatus(row.clientId, status);
    success.value = `Cliente ${status === "blocked" ? "bloqueado" : "activado"} correctamente.`;
    await load();
  } catch (statusError) {
    error.value = statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado.";
  } finally {
    mutationLoading.value = false;
  }
};

const openMerge = (row: CustomerRow) => {
  mergeSource.value = row;
  mergeOpen.value = true;
};

const handleMerge = async (targetClientId: string) => {
  if (!mergeSource.value) return;
  mutationLoading.value = true;
  error.value = null;
  success.value = null;
  try {
    await mergeCustomers(targetClientId, mergeSource.value.clientId);
    success.value = "Clientes fusionados correctamente.";
    mergeOpen.value = false;
    mergeSource.value = null;
    await load();
  } catch (mergeError) {
    error.value = mergeError instanceof Error ? mergeError.message : "No se pudo fusionar clientes.";
  } finally {
    mutationLoading.value = false;
  }
};

watch(
  () => filters.includeAnonymous,
  async () => {
    await applyFilters();
  },
);

watch(
  () => page.value,
  async () => {
    await load();
  },
);

onMounted(async () => {
  await load();
});
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-x"
      :title="error"
    />

    <UAlert
      v-if="success"
      color="success"
      variant="soft"
      icon="i-lucide-circle-check"
      :title="success"
    />

    <CustomersTabs v-model="activeTab" />

    <div v-if="activeTab === 'summary'" class="space-y-6">
          <UiModuleHero
            eyebrow="Operaciones"
            title="Clientes"
            description="Gestiona cartera de clientes por organización: alta, edición, estado y fusión."
            icon="i-lucide-users-round"
          />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <UiStatCard label="Clientes totales" :value="summary.total" icon="i-lucide-users-round" icon-class="text-sky-600 dark:text-sky-300" icon-wrapper-class="bg-sky-100 dark:bg-sky-950/50" />
            <UiStatCard label="Activos" :value="summary.active" icon="i-lucide-badge-check" icon-class="text-emerald-600 dark:text-emerald-300" icon-wrapper-class="bg-emerald-100 dark:bg-emerald-950/50" />
            <UiStatCard label="Bloqueados" :value="summary.blocked" icon="i-lucide-shield-x" icon-class="text-rose-600 dark:text-rose-300" icon-wrapper-class="bg-rose-100 dark:bg-rose-950/40" />
            <UiStatCard label="Inactivos" :value="summary.inactive" icon="i-lucide-user-minus" icon-class="text-slate-600 dark:text-slate-300" icon-wrapper-class="bg-slate-100 dark:bg-slate-900/60" />
            <UiStatCard label="Templates anon." :value="summary.anonymousTemplates" icon="i-lucide-user-circle-2" icon-class="text-violet-600 dark:text-violet-300" icon-wrapper-class="bg-violet-100 dark:bg-violet-950/40" />
          </div>

          <UCard :ui="{ body: 'p-5 md:p-6' }">
            <div class="flex flex-wrap items-center gap-3">
              <UButton color="primary" icon="i-lucide-list" @click="activeTab = 'customers'">
                Ir a cartera
              </UButton>
              <UButton color="neutral" variant="soft" icon="i-lucide-user-plus" @click="activeTab = 'customers'; openCreate()">
                Nuevo cliente
              </UButton>
              <UButton color="neutral" variant="soft" icon="i-lucide-filter" @click="activeTab = 'customers'; filters.status = 'blocked'; applyFilters()">
                Ver bloqueados
              </UButton>
            </div>
          </UCard>
    </div>

    <div v-else class="space-y-6">
          <div class="flex justify-end">
            <UButton color="primary" icon="i-lucide-user-plus" @click="openCreate">
              Nuevo cliente
            </UButton>
          </div>

          <UiSearchFilters title="Filtrar clientes" description="Busca por nombre, email o teléfono y filtra por estado." surface>
            <template #controls>
              <div class="grid grid-cols-1 gap-3 xl:grid-cols-4">
                <UInput
                  v-model="filters.search"
                  icon="i-lucide-search"
                  placeholder="Buscar cliente..."
                  class="xl:col-span-2"
                />

                <USelect
                  v-model="filters.status"
                  :items="statusFilterOptions"
                  label-key="label"
                  value-key="value"
                  class="w-full"
                />

                <div class="flex items-center">
                  <UCheckbox v-model="filters.includeAnonymous" label="Incluir anónimo template" />
                </div>
              </div>
            </template>

            <template #summary>
              {{ summaryText }}
            </template>

            <template #actions>
              <div class="flex gap-2">
                <UButton color="neutral" variant="soft" @click="clearFilters">Limpiar</UButton>
                <UButton color="primary" variant="soft" :loading="loading" @click="applyFilters">Aplicar</UButton>
              </div>
            </template>
          </UiSearchFilters>

          <CustomersTable
            :rows="rows"
            :loading="loading || mutationLoading"
            :page="page"
            :page-count="pageCount"
            :page-label="summaryText"
            :previous-disabled="page <= 1"
            :next-disabled="page >= pageCount"
            @edit="openEdit"
            @set-status="handleSetStatus"
            @open-merge="openMerge"
            @previous="page = Math.max(1, page - 1)"
            @next="page = Math.min(pageCount, page + 1)"
          />
    </div>

    <CustomerFormModal
      :open="formOpen"
      :mode="editingCustomer ? 'edit' : 'create'"
      :loading="mutationLoading"
      :initial-value="editingCustomer"
      @update:open="formOpen = $event"
      @submit="handleSave"
      @cancel="formOpen = false"
    />

    <CustomerMergeModal
      :open="mergeOpen"
      :loading="mutationLoading"
      :source-customer="mergeSource"
      :candidates="mergeCandidates"
      @update:open="mergeOpen = $event"
      @submit="handleMerge"
    />
  </div>
</template>

