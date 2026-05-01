import type { AccessibleBranch } from "@/types/permissions";

export type ModuleBranchKey = "inventory" | "pos" | "service-assignment";

const STORAGE_PREFIX = "branch-context";

const moduleStateKey = (moduleKey: ModuleBranchKey) => `branch-context:selected:${moduleKey}`;

const moduleStorageKey = (moduleKey: ModuleBranchKey, userId: string) => `${STORAGE_PREFIX}:${moduleKey}:${userId}`;

export const useModuleBranchContext = (moduleKey: ModuleBranchKey) => {
  const { user, profile } = useAuth();
  const { branches, loading, refreshBranches } = useActiveBranch();

  const selectedBranchId = useState<string | null>(moduleStateKey(moduleKey), () => null);

  const accessibleBranches = computed<AccessibleBranch[]>(() =>
    (branches.value ?? []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code ?? null,
      address: null,
    })),
  );

  const selectedBranch = computed<AccessibleBranch | null>(() =>
    accessibleBranches.value.find((branch) => branch.id === selectedBranchId.value)
    ?? accessibleBranches.value[0]
    ?? null,
  );

  const canSwitch = computed(() => accessibleBranches.value.length > 1);

  const setSelectedBranch = (branchId: string | null) => {
    selectedBranchId.value = branchId;
  };

  const restoreSelectedBranch = async () => {
    await refreshBranches();

    const options = accessibleBranches.value;
    const userId = user.value?.id ?? null;
    const role = profile.value?.role ?? null;

    // Keep strict module scoping to operational roles only.
    if (!userId || (role !== "admin" && role !== "manager" && role !== "employee")) {
      selectedBranchId.value = null;
      return null;
    }

    if (options.length === 0) {
      selectedBranchId.value = null;
      if (import.meta.client) {
        localStorage.removeItem(moduleStorageKey(moduleKey, userId));
      }
      return null;
    }

    const validIds = new Set(options.map((branch) => branch.id));
    const currentSelection = selectedBranchId.value;
    const storageKey = moduleStorageKey(moduleKey, userId);

    if (import.meta.client) {
      const stored = localStorage.getItem(storageKey);
      if (stored && validIds.has(stored)) {
        selectedBranchId.value = stored;
        return stored;
      }
    }

    if (currentSelection && validIds.has(currentSelection)) {
      if (import.meta.client) {
        localStorage.setItem(storageKey, currentSelection);
      }
      return currentSelection;
    }

    const fallback = options[0]?.id ?? null;
    selectedBranchId.value = fallback;
    if (import.meta.client && fallback) {
      localStorage.setItem(storageKey, fallback);
    }
    return fallback;
  };

  watch(
    () => [user.value?.id ?? null, profile.value?.role ?? null] as const,
    async ([userId, role]) => {
      if (!userId || (role !== "admin" && role !== "manager" && role !== "employee")) {
        selectedBranchId.value = null;
        return;
      }

      await restoreSelectedBranch();
    },
    { immediate: true },
  );

  watch(
    () => accessibleBranches.value,
    async () => {
      await restoreSelectedBranch();
    },
    { deep: true },
  );

  watch(
    () => selectedBranchId.value,
    (next) => {
      const userId = user.value?.id ?? null;
      if (!import.meta.client || !userId) {
        return;
      }

      const storageKey = moduleStorageKey(moduleKey, userId);
      if (!next) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, next);
      }
    },
  );

  return {
    branches: accessibleBranches,
    selectedBranchId,
    selectedBranch,
    canSwitch,
    loading,
    setSelectedBranch,
    restoreSelectedBranch,
    refreshBranches,
  };
};

