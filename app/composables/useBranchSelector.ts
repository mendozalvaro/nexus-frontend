import type { AccessibleBranch } from "@/types/permissions";

const BRANCH_STORAGE_KEY = "nexuspos.active-branch";

export const useBranchSelector = () => {
  const selectedBranchId = useState<string | null>(
    "branch-selector:selected-branch-id",
    () => null,
  );

  const hasBranchSelection = computed(() => Boolean(selectedBranchId.value));

  const syncStorage = (branchId: string | null) => {
    if (!import.meta.client) {
      return;
    }

    if (branchId) {
      localStorage.setItem(BRANCH_STORAGE_KEY, branchId);
      return;
    }

    localStorage.removeItem(BRANCH_STORAGE_KEY);
  };

  const setSelectedBranch = (branchId: string | null) => {
    selectedBranchId.value = branchId;
    syncStorage(branchId);
  };

  const restoreSelectedBranch = async (
    accessibleBranches: AccessibleBranch[],
  ): Promise<string | null> => {
    const validBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
    const currentSelection = selectedBranchId.value;

    if (!import.meta.client) {
      if (!currentSelection || !validBranchIds.has(currentSelection)) {
        selectedBranchId.value = accessibleBranches[0]?.id ?? null;
      }

      return selectedBranchId.value;
    }

    const storedBranchId = localStorage.getItem(BRANCH_STORAGE_KEY);
    if (storedBranchId && validBranchIds.has(storedBranchId)) {
      selectedBranchId.value = storedBranchId;
      return storedBranchId;
    }

    if (currentSelection && validBranchIds.has(currentSelection)) {
      syncStorage(currentSelection);
      return currentSelection;
    }

    const fallbackBranchId = accessibleBranches[0]?.id ?? null;
    setSelectedBranch(fallbackBranchId);
    return fallbackBranchId;
  };

  return {
    selectedBranchId,
    hasBranchSelection,
    setSelectedBranch,
    restoreSelectedBranch,
  };
};
