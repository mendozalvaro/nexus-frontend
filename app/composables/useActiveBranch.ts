import { CACHE_KEYS } from "@/utils/cache-keys";

const ACTIVE_BRANCH_STORAGE_KEY = "nexus:active-branch";
type BranchSummary = { id: string; name: string; code: string | null; is_active: boolean | null };

export const useActiveBranch = () => {
  const route = useRoute();
  const user = useSupabaseUser();

  const shouldFetchBranches = computed(() => {
    if (!user.value) return false;
    if (route.path.startsWith("/system")) return false;
    if (import.meta.client && window.location.pathname.startsWith("/system")) return false;

    const metadata = (user.value.user_metadata ?? {}) as Record<string, unknown>;
    const role = typeof metadata.role === "string" ? metadata.role : null;
    const organizationId = typeof metadata.organization_id === "string"
      ? metadata.organization_id
      : null;

    return role !== "system" && role !== "support" && Boolean(organizationId);
  });

  const { data, pending, refresh, error } = useFetch<BranchSummary[]>("/api/branches", {
    key: CACHE_KEYS.branches,
    lazy: true,
    dedupe: "defer",
    immediate: shouldFetchBranches.value,
    default: () => [],
  });

  const branchList = computed<BranchSummary[]>(() => Array.isArray(data.value) ? data.value : []);

  const activeBranchId = useState<string | null>("active-branch-id", () => null);

  if (import.meta.client && !activeBranchId.value) {
    const fromStorage = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
    activeBranchId.value = fromStorage && fromStorage.length > 0 ? fromStorage : null;
  }

  const activeBranch = computed(() => {
    const branches = branchList.value;
    if (branches.length === 0) return null;
    if (!activeBranchId.value) return branches[0] ?? null;
    return branches.find((branch) => branch.id === activeBranchId.value) ?? branches[0] ?? null;
  });

  const setActiveBranch = (branchId: string | null) => {
    activeBranchId.value = branchId;
    if (import.meta.client) {
      if (!branchId) {
        localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
      } else {
        localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
      }
    }
  };

  watch(activeBranch, (value) => {
    if (!value) return;
    if (activeBranchId.value !== value.id) {
      setActiveBranch(value.id);
    }
  }, { immediate: true });

  watch(
    shouldFetchBranches,
    async (enabled) => {
      if (route.path.startsWith("/system")) {
        data.value = [];
        activeBranchId.value = null;
        if (import.meta.client) {
          localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
        }
        return;
      }

      if (!enabled) {
        data.value = [];
        activeBranchId.value = null;
        if (import.meta.client) {
          localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
        }
        return;
      }

      await refresh();
    },
    { immediate: false },
  );

  return {
    branches: branchList,
    activeBranchId,
    activeBranch,
    loading: pending,
    error,
    refreshBranches: refresh,
    setActiveBranch,
  };
};
