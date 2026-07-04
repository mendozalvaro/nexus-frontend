import type { ComputedRef, Ref } from "vue";

type SearchableValue = string | null | undefined;

export const useCatalogSearchFilter = <T>(
  items: ComputedRef<T[]>,
  searchQuery: Ref<string>,
  selectValues: (item: T) => SearchableValue[],
) => computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return items.value;
  }

  return items.value.filter((item) =>
    selectValues(item).some((value) => (value ?? "").toLowerCase().includes(query)),
  );
});
