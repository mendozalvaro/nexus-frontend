<script setup lang="ts">
import { ADMIN_FIELD_SM_UI, ADMIN_FIELD_WITH_TRAILING_UI } from "@/utils/ui/forms";

interface InventoryProductPickerItem {
  id: string;
  name: string;
  sku?: string | null;
  categoryName?: string | null;
  isActive: boolean;
}

const props = withDefaults(defineProps<{
  modelValue: string;
  items: InventoryProductPickerItem[];
  excludedIds?: string[];
  disabled?: boolean;
  inputId?: string;
  inputName?: string;
  placeholder?: string;
  searchPlaceholder?: string;
}>(), {
  excludedIds: () => [],
  disabled: false,
  inputId: undefined,
  inputName: undefined,
  placeholder: "Buscar producto...",
  searchPlaceholder: "Buscar por nombre, SKU o categoría...",
});

const emits = defineEmits<{
  "update:modelValue": [string];
  open: [];
  close: [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const isOpen = ref(false);

const selectedProduct = computed(() => {
  return props.items.find((item) => item.id === props.modelValue) ?? null;
});

const normalizedExcludedIds = computed(() => {
  return new Set(props.excludedIds.filter(Boolean));
});

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return props.items.filter((item) => {
    if (!item.isActive) {
      return false;
    }

    if (item.id !== props.modelValue && normalizedExcludedIds.value.has(item.id)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [item.name, item.sku ?? "", item.categoryName ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
});

const selectedLabel = computed(() => {
  if (!selectedProduct.value) {
    return "";
  }

  return selectedProduct.value.sku
    ? `${selectedProduct.value.name} (${selectedProduct.value.sku})`
    : selectedProduct.value.name;
});

function openDropdown() {
  if (props.disabled) {
    return;
  }

  isOpen.value = true;
  searchQuery.value = "";
  emits("open");
}

function closeDropdown() {
  if (!isOpen.value) {
    return;
  }

  isOpen.value = false;
  searchQuery.value = "";
  emits("close");
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
    return;
  }

  openDropdown();
}

function selectProduct(productId: string) {
  emits("update:modelValue", productId);
  closeDropdown();
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!rootRef.value?.contains(target)) {
    closeDropdown();
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeDropdown();
  }
}

watch(() => props.disabled, (disabled) => {
  if (disabled) {
    closeDropdown();
  }
});

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
  document.removeEventListener("keydown", handleEscape);
});

defineExpose({
  closeDropdown,
});
</script>

<template>
  <div ref="rootRef" class="relative">
    <UInput
      :id="inputId"
      :name="inputName"
      :model-value="selectedLabel"
      :placeholder="placeholder"
      readonly
      class="w-full"
      :disabled="disabled"
      :ui="ADMIN_FIELD_WITH_TRAILING_UI"
      :class="selectedProduct ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'"
      @click="toggleDropdown"
    />

    <div class="absolute inset-y-0 right-0 flex items-center pr-2">
      <UIcon
        :name="isOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="h-5 w-5 text-slate-400"
      />
    </div>

    <div
      v-if="isOpen"
      class="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      <div class="sticky top-0 border-b border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
        <UInput
          v-model="searchQuery"
          :name="inputName ? `${inputName}-search` : undefined"
          :placeholder="searchPlaceholder"
          size="sm"
          class="w-full"
          :ui="ADMIN_FIELD_SM_UI"
          @keydown.stop
        />
      </div>

      <button
        v-for="item in filteredItems"
        :key="item.id"
        type="button"
        class="w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        @click="selectProduct(item.id)"
      >
        <div class="flex justify-between gap-3">
          <span>{{ item.sku ? `${item.name} (${item.sku})` : item.name }}</span>
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">
            {{ item.categoryName || "Sin categoría" }}
          </span>
        </div>
      </button>

      <div
        v-if="filteredItems.length === 0"
        class="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400"
      >
        Sin resultados
      </div>
    </div>
  </div>
</template>
