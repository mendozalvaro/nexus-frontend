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
  const { organization } = useGlobalOrganization();
  const { activeBranch } = useActiveBranch();
  const period = useState<"7d" | "30d" | "90d">("dashboard:period", () => "30d");

  const key = computed(() => dashboardStatsKey({
    organizationId: (organization.value as { id?: string } | null)?.id ?? null,
    branchId: activeBranch.value?.id ?? null,
    period: period.value,
  }));

  const query = computed(() => ({
    period: period.value,
    branchId: activeBranch.value?.id ?? undefined,
  }));

  const { data, pending, refresh, error } = useFetch<DashboardStats>("/api/dashboard-stats", {
    key,
    query,
    lazy: true,
    dedupe: "defer",
    default: () => defaultStats(period.value),
  });

  const refreshStats = async () => {
    await refresh();
  };

  return {
    cachePrefix: CACHE_KEYS.dashboardStats,
    stats: data,
    period,
    loading: pending,
    error,
    refreshStats,
  };
};
