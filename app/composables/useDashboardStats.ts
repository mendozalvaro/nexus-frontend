import { CACHE_KEYS, dashboardStatsKey } from "@/utils/cache-keys";

interface DashboardStats {
  sales: number;
  appointments: number;
  products: number;
  customers: number;
  period: "7d" | "30d" | "90d";
  branchId: string | null;
}

const defaultStats = (period: "7d" | "30d" | "90d"): DashboardStats => ({
  sales: 0,
  appointments: 0,
  products: 0,
  customers: 0,
  period,
  branchId: null,
});

export const useDashboardStats = () => {
  const { branches, activeBranch, loading: branchesLoading } = useActiveBranch();
  const period = useState<"7d" | "30d" | "90d">("dashboard:period", () => "30d");
  const stats = useState<DashboardStats>("dashboard:stats:data", () => defaultStats(period.value));
  const loading = useState<boolean>("dashboard:stats:loading", () => false);
  const error = useState<Error | null>("dashboard:stats:error", () => null);
  const loadedKey = useState<string | null>("dashboard:stats:loaded-key", () => null);
  const pendingKey = useState<string | null>("dashboard:stats:pending-key", () => null);

  let pendingLoad: Promise<void> | null = null;

  const key = computed(() => dashboardStatsKey({
    organizationId: null,
    branchId: activeBranch.value?.id ?? null,
    period: period.value,
  }));

  const query = computed(() => ({
    period: period.value,
    branchId: activeBranch.value?.id ?? undefined,
  }));

  const refreshStats = async (options: { force?: boolean } = {}) => {
    const currentKey = key.value;
    const force = options.force === true;

    if (!force && loadedKey.value === currentKey) {
      return;
    }

    if (pendingLoad && pendingKey.value === currentKey) {
      await pendingLoad;
      return;
    }

    const loader = async () => {
      loading.value = true;
      error.value = null;

      try {
        stats.value = await $fetch<DashboardStats>("/api/dashboard-stats", {
          query: query.value,
        });
        loadedKey.value = currentKey;
      } catch (fetchError) {
        error.value = fetchError instanceof Error
          ? fetchError
          : new Error("No se pudieron cargar las metricas del dashboard.");
      } finally {
        loading.value = false;
        if (pendingKey.value === currentKey) {
          pendingLoad = null;
          pendingKey.value = null;
        }
      }
    };

    pendingLoad = loader();
    pendingKey.value = currentKey;
    await pendingLoad;
  };

  watch(
    () => [period.value, activeBranch.value?.id ?? null, branchesLoading.value, branches.value.length] as const,
    async ([, activeBranchId, isBranchesLoading, branchCount]) => {
      if (isBranchesLoading) {
        return;
      }

      if (branchCount > 0 && !activeBranchId) {
        return;
      }

      await refreshStats();
    },
    { immediate: true },
  );

  return {
    cachePrefix: CACHE_KEYS.dashboardStats,
    stats,
    period,
    loading,
    error,
    refreshStats,
  };
};
