<script setup lang="ts">
import type {
  POSEmployeeItem,
  POSProductItem,
  POSServiceItem,
} from "@/composables/usePOS";

const props = withDefaults(defineProps<{
  products: POSProductItem[];
  services: POSServiceItem[];
  employees: POSEmployeeItem[];
  categories: Array<{ id: string; name: string; type: string }>;
  selectedBranchId: string;
  loading?: boolean;
}>(), {
  loading: false,
});

const emits = defineEmits<{
  "add-product": [{ product: POSProductItem; quantity: number }];
  "add-service": [{ service: POSServiceItem; employee: POSEmployeeItem; scheduledDate: string; scheduledTime: string }];
}>();

const { canEmployeeDeliverService } = usePOS();

const search = ref("");
const activeTab = ref<"products" | "services">("products");
const productCategoryId = ref<string>("all");
const serviceCategoryId = ref<string>("all");
const selectedService = ref<POSServiceItem | null>(null);
const serviceModalOpen = ref(false);
const serviceState = reactive({
  employeeId: "",
  scheduledDate: "",
  scheduledTime: "09:00",
});

const productCategories = computed(() => props.categories.filter((category) => category.type === "product"));
const serviceCategories = computed(() => props.categories.filter((category) => category.type === "service"));
const normalizedSearch = computed(() => search.value.trim().toLowerCase());

const filteredProducts = computed(() => {
  return props.products.filter((product) => {
    if (productCategoryId.value !== "all" && product.categoryId !== productCategoryId.value) {
      return false;
    }

    if (!normalizedSearch.value) {
      return true;
    }

    return [
      product.name,
      product.sku ?? "",
      product.categoryName ?? "",
      product.description ?? "",
    ].join(" ").toLowerCase().includes(normalizedSearch.value);
  });
});

const filteredServices = computed(() => {
  return props.services.filter((service) => {
    if (serviceCategoryId.value !== "all" && service.categoryId !== serviceCategoryId.value) {
      return false;
    }

    if (!normalizedSearch.value) {
      return true;
    }

    return [
      service.name,
      service.categoryName ?? "",
      service.description ?? "",
    ].join(" ").toLowerCase().includes(normalizedSearch.value);
  });
});

const branchStockLabel = (product: POSProductItem) => {
  if (!product.trackInventory) {
    return "Sin control de stock";
  }

  return `Disponible: ${product.stockByBranch[props.selectedBranchId] ?? 0}`;
};

const availableEmployees = computed(() => {
  if (!selectedService.value) {
    return [];
  }

  return props.employees.filter((employee) => {
    return canEmployeeDeliverService(employee, selectedService.value?.id ?? "", props.selectedBranchId);
  });
});

const openServiceModal = (service: POSServiceItem) => {
  selectedService.value = service;
  serviceState.employeeId = availableEmployees.value[0]?.id ?? "";
  serviceState.scheduledDate = new Date().toISOString().slice(0, 10);
  serviceState.scheduledTime = "09:00";
  serviceModalOpen.value = true;
};

watch(
  () => selectedService.value,
  () => {
    serviceState.employeeId = availableEmployees.value[0]?.id ?? "";
  },
);

const submitService = () => {
  if (!selectedService.value) {
    return;
  }

  const employee = availableEmployees.value.find((item) => item.id === serviceState.employeeId);
  if (!employee) {
    return;
  }

  emits("add-service", {
    service: selectedService.value,
    employee,
    scheduledDate: serviceState.scheduledDate,
    scheduledTime: serviceState.scheduledTime,
  });
  serviceModalOpen.value = false;
};
</script>

<template>
  <div class="space-y-4 md:space-y-5">
    <div class="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80 md:p-5">
      <div class="flex flex-col gap-4">
        <div class="flex-1">
          <label class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Buscar en el catalogo
          </label>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Nombre, SKU, categoria o descripcion"
            :disabled="loading"
            :ui="{ base: 'min-h-11 text-base' }"
          />
        </div>

        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <UButton
            :color="activeTab === 'products' ? 'primary' : 'neutral'"
            :variant="activeTab === 'products' ? 'solid' : 'soft'"
            class="min-h-11 justify-center"
            @click="activeTab = 'products'"
          >
            Productos
          </UButton>
          <UButton
            :color="activeTab === 'services' ? 'primary' : 'neutral'"
            :variant="activeTab === 'services' ? 'solid' : 'soft'"
            class="min-h-11 justify-center"
            @click="activeTab = 'services'"
          >
            Servicios
          </UButton>
        </div>
      </div>

      <div v-if="activeTab === 'products'" class="mt-4">
        <label class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Categoria de productos
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="productCategoryId" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option value="all">Todas</option>
            <option v-for="category in productCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-else class="mt-4">
        <label class="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Categoria de servicios
        </label>
        <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
          <select v-model="serviceCategoryId" class="min-h-10 w-full bg-transparent text-sm outline-none">
            <option value="all">Todas</option>
            <option v-for="category in serviceCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'products'" class="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      <UCard v-for="product in filteredProducts" :key="product.id" class="rounded-[1.5rem]">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-semibold text-slate-950 dark:text-white">
                {{ product.name }}
              </p>
              <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                {{ product.categoryName ?? "Sin categoria" }}{{ product.sku ? ` · ${product.sku}` : "" }}
              </p>
            </div>
            <span class="shrink-0 text-sm font-semibold text-primary-600 dark:text-primary-400">
              Bs {{ product.price.toFixed(2) }}
            </span>
          </div>

          <p class="min-h-[3rem] text-sm leading-6 text-slate-500 dark:text-slate-400">
            {{ product.description ?? "Producto listo para venta desde el POS hibrido." }}
          </p>

          <div class="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <span class="truncate">{{ branchStockLabel(product) }}</span>
          </div>

          <UButton
            block
            color="primary"
            icon="i-lucide-plus"
            class="min-h-11"
            :disabled="product.trackInventory && (product.stockByBranch[selectedBranchId] ?? 0) <= 0"
            @click="emits('add-product', { product, quantity: 1 })"
          >
            Agregar al carrito
          </UButton>
        </div>
      </UCard>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      <UCard v-for="service in filteredServices" :key="service.id" class="rounded-[1.5rem]">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-semibold text-slate-950 dark:text-white">
                {{ service.name }}
              </p>
              <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                {{ service.categoryName ?? "Sin categoria" }} · {{ service.durationMinutes }} min
              </p>
            </div>
            <span class="shrink-0 text-sm font-semibold text-primary-600 dark:text-primary-400">
              Bs {{ service.price.toFixed(2) }}
            </span>
          </div>

          <p class="min-h-[3rem] text-sm leading-6 text-slate-500 dark:text-slate-400">
            {{ service.description ?? "Servicio disponible para venta directa y programacion interna." }}
          </p>

          <UButton block color="primary" variant="soft" icon="i-lucide-calendar-plus" class="min-h-11" @click="openServiceModal(service)">
            Agendar y agregar
          </UButton>
        </div>
      </UCard>
    </div>

    <UAlert
      v-if="activeTab === 'products' && filteredProducts.length === 0"
      color="neutral"
      variant="soft"
      icon="i-lucide-package-search"
      title="Sin productos"
      description="No encontramos productos con ese criterio de busqueda."
    />

    <UAlert
      v-if="activeTab === 'services' && filteredServices.length === 0"
      color="neutral"
      variant="soft"
      icon="i-lucide-scissors"
      title="Sin servicios"
      description="No encontramos servicios con ese criterio de busqueda."
    />

    <UModal
      :open="serviceModalOpen"
      title="Agregar servicio al carrito"
      description="Selecciona colaborador y horario disponible para la venta directa del servicio."
      @update:open="serviceModalOpen = $event"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Colaborador">
            <div class="rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <select v-model="serviceState.employeeId" class="min-h-10 w-full bg-transparent text-sm outline-none">
                <option value="">Selecciona un colaborador</option>
                <option v-for="employee in availableEmployees" :key="employee.id" :value="employee.id">
                  {{ employee.fullName }}
                </option>
              </select>
            </div>
          </UFormField>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Fecha">
              <UInput v-model="serviceState.scheduledDate" type="date" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>

            <UFormField label="Hora">
              <UInput v-model="serviceState.scheduledTime" type="time" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>

          <UAlert
            v-if="availableEmployees.length === 0"
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            title="Sin colaboradores disponibles"
            description="No hay colaboradores con permiso operativo para prestar este servicio en la sucursal seleccionada."
          />

          <UiResponsiveModalActions>
            <UButton color="neutral" variant="ghost" block class="min-h-11 sm:w-auto" @click="serviceModalOpen = false">
              Cancelar
            </UButton>
            <UButton
              color="primary"
              block
              class="min-h-11 sm:w-auto"
              :disabled="!serviceState.employeeId || !serviceState.scheduledDate || availableEmployees.length === 0"
              @click="submitService"
            >
              Agregar servicio
            </UButton>
          </UiResponsiveModalActions>
        </div>
      </template>
    </UModal>
  </div>
</template>
