<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["permissions"],
  permission: "profile.view",
  roles: ["admin", "manager", "employee"],
});

const { getAccessibleBranches } = usePermissions();
const { selectedBranchId, setSelectedBranch, restoreSelectedBranch } = useBranchSelector();
const route = useRoute();
const router = useRouter();

const branches = ref<Awaited<ReturnType<typeof getAccessibleBranches>>>([]);
const loading = ref(false);

const redirectTarget = computed(() => {
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard";
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/dashboard";
  }

  return redirect;
});

const selectBranch = async (branchId = selectedBranchId.value) => {
  if (!branchId) {
    return;
  }

  loading.value = true;

  try {
    setSelectedBranch(branchId);
    await router.push(redirectTarget.value);
  } catch (error) {
    console.error("Error selecting branch:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  branches.value = await getAccessibleBranches();

  if (branches.value.length === 1) {
    const [singleBranch] = branches.value;
    if (singleBranch) {
      await selectBranch(singleBranch.id);
    }
    return;
  }

  await restoreSelectedBranch(branches.value);
});
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-2xl font-bold text-center">Seleccionar Sucursal</h1>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Selecciona la sucursal activa para continuar.
        </p>
      </template>

      <div class="space-y-4">
        <USelect
          v-model="selectedBranchId"
          :options="branches.map((branch) => ({ label: branch.name, value: branch.id }))"
          placeholder="Selecciona una sucursal"
          label="Sucursal"
        />

        <UButton
          :disabled="!selectedBranchId || loading"
          :loading="loading"
          class="w-full"
          @click="selectBranch()"
        >
          Continuar
        </UButton>
      </div>
    </UCard>
  </div>
</template>
