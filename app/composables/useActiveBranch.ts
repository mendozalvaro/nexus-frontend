import { CACHE_KEYS } from "@/utils/cache-keys";

const ACTIVE_BRANCH_STORAGE_KEY = "nexus:active-branch";

type BranchSummary = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean | null;
};

export const useActiveBranch = () => {
  const route = useRoute();
  const { user, role } = useUserContext();

  const shouldFetchBranches = computed(() => {
    if (
      route.path === "/"
      || route.path.startsWith("/auth")
      || route.path.startsWith("/client")
      || route.path === "/terms"
      || route.path === "/privacy"
      || route.path.startsWith("/system")
    ) {
      return false;
    }

    if (!user.value) {
      return false;
    }

    return role.value !== "client";
  });

  const { data, pending, refresh, error } = useFetch<BranchSummary[]>("/api/branches", {
    key: CACHE_KEYS.branches,
    lazy: true,
    dedupe: "defer",
    immediate: false,
    default: () => [],
  });

  const branchList = computed<BranchSummary[]>(() => Array.isArray(data.value) ? data.value : []);
  const activeBranchId = useState<string | null>("active-branch-id", () => null);

  if (import.meta.client && !activeBranchId.value) {
    const fromStorage = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
    activeBranchId.value = fromStorage && fromStorage.length > 0 ? fromStorage : null;
  }

  const clearBranchState = () => {
    data.value = [];
    activeBranchId.value = null;

    if (import.meta.client) {
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
    }
  };

  const activeBranch = computed(() => {
    const branches = branchList.value;
    if (branches.length === 0) {
      return null;
    }

    if (!activeBranchId.value) {
      return branches[0] ?? null;
    }

    return branches.find((branch) => branch.id === activeBranchId.value) ?? branches[0] ?? null;
  });

  const setActiveBranch = (branchId: string | null) => {
    activeBranchId.value = branchId;

    if (!import.meta.client) {
      return;
    }

    if (!branchId) {
      localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
      return;
    }

    localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
  };

  watch(activeBranch, (value) => {
    if (!value || activeBranchId.value === value.id) {
      return;
    }

    setActiveBranch(value.id);
  }, { immediate: true });

  watch(
    shouldFetchBranches,
    async (enabled) => {
      if (!enabled) {
        clearBranchState();
        return;
      }

      await refresh();
    },
    { immediate: true },
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
