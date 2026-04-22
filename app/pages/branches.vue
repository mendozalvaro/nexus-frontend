<script setup lang="ts">
import BranchesCrudTab from "@/components/branches/BranchesCrudTab.vue";
import BranchesFormModal from "@/components/branches/BranchesFormModal.vue";
import BranchesSummaryTab from "@/components/branches/BranchesSummaryTab.vue";
import BranchesTabs from "@/components/branches/BranchesTabs.vue";

import type { BranchesTabKey } from "@/components/branches/BranchesTabs.vue";
import type { BranchListItem, BranchMutationPayload } from "@/composables/useBranches";

definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "branches.view",
  roles: ["admin"],
  featureFlag: "feature_multi_branch",
});

const searchQuery = ref("");
const activeTab = ref<BranchesTabKey>("summary");
const mutationLoading = ref(false);
const branchModalOpen = ref(false);
const editingBranch = ref<BranchListItem | null>(null);

const {
  loadBranches,
  createBranch,
  updateBranch,
  updateBranchStatus,
  branchLimitMessage,
  canCreateMoreBranches,
} = useBranches();

const { data, pending, refresh } = await useAsyncData(
  "branches-module",
  () => loadBranches(),
  { server: false },
);

const branchList = computed(() => data.value?.branches ?? []);
const filteredBranches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return branchList.value;
  }

  return branchList.value.filter((branch) =>
    [branch.name, branch.code, branch.address ?? "", branch.phone ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
});

const openBranchModal = (branch?: BranchListItem) => {
  editingBranch.value = branch ?? null;
  branchModalOpen.value = true;
};

const editingBranchInitial = computed<BranchMutationPayload | undefined>(() => {
  if (!editingBranch.value) {
    return undefined;
  }

  return {
    name: editingBranch.value.name,
    code: editingBranch.value.code,
    address: editingBranch.value.address ?? "",
    phone: editingBranch.value.phone ?? "",
    settings: editingBranch.value.settings,
  };
});

const handleBranchSubmit = async (payload: BranchMutationPayload) => {
  mutationLoading.value = true;
  try {
    if (editingBranch.value) {
      await updateBranch(editingBranch.value.id, payload);
    } else {
      await createBranch(payload);
    }

    branchModalOpen.value = false;
    editingBranch.value = null;
    await refresh();
  } finally {
    mutationLoading.value = false;
  }
};

const handleBranchStatusChange = async (branchId: string, isActive: boolean) => {
  try {
    await updateBranchStatus(branchId, isActive);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await refresh();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error updating branch status:", errorMessage);
  }
};
</script>

<template>
  <div class="space-y-6 md:space-y-8">
    <BranchesTabs v-model="activeTab" />

    <BranchesSummaryTab
      v-if="activeTab === 'summary'"
      :branches="branchList"
      :loading="pending || mutationLoading"
    />

    <BranchesCrudTab
      v-else
      :rows="filteredBranches"
      :search-query="searchQuery"
      :loading="pending || mutationLoading"
      :can-create-more-branches="canCreateMoreBranches"
      @update:search-query="searchQuery = $event"
      @create="openBranchModal()"
      @edit="openBranchModal($event)"
      @toggle-status="handleBranchStatusChange($event.branchId, $event.nextState)"
    />

    <BranchesFormModal
      :open="branchModalOpen"
      :mode="editingBranch ? 'edit' : 'create'"
      :loading="mutationLoading"
      :initial-value="editingBranchInitial"
      :limit-message="branchLimitMessage"
      @update:open="branchModalOpen = $event"
      @submit="handleBranchSubmit"
      @cancel="branchModalOpen = false"
    />
  </div>
</template>
