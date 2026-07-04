export const useBusinessTypes = () => {
  const { capabilities } = useSubscription();

  const businessTypes = computed(() => capabilities.value?.businessTypes ?? []);

  const hasBusinessType = (type: string): boolean => {
    return businessTypes.value.includes(type);
  };

  const isOnlyProduct = computed(() => businessTypes.value.length === 1 && businessTypes.value[0] === "product");
  const isOnlyService = computed(() => businessTypes.value.length === 1 && businessTypes.value[0] === "service");
  const isOnlyLodging = computed(() => businessTypes.value.length === 1 && businessTypes.value[0] === "lodging");
  const isProductAndService = computed(() =>
    businessTypes.value.includes("product") && businessTypes.value.includes("service"),
  );

  return {
    businessTypes,
    hasBusinessType,
    isOnlyProduct,
    isOnlyService,
    isOnlyLodging,
    isProductAndService,
  };
};
