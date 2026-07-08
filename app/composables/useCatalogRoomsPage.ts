import type { Ref } from "vue";
import type {
  CatalogCategoryItem,
  CatalogRoomItem,
  CatalogRoomPayload,
} from "@/composables/useCatalog";
import type { CatalogTab } from "@/composables/catalogPage.types";

type CatalogMutationState = {
  loading: Ref<boolean>;
  error: Ref<string | null>;
};

export const useCatalogRoomsPage = ({
  activeTab,
  searchQuery,
  mutationState,
}: {
  activeTab: Ref<CatalogTab>;
  searchQuery: Ref<string>;
  mutationState: CatalogMutationState;
}) => {
  const { profile } = useUserContext();
  const { hasModuleAccess } = usePermissions();
  const { loadBranches } = useBranches();
  const {
    loadLodgingCategories,
    loadRooms,
    createRoom,
    updateRoom,
    updateRoomStatus,
  } = useCatalog();

  const roomModalOpen = ref(false);
  const editingRoom = ref<CatalogRoomItem | null>(null);

  const canViewRoomCatalog = computed(() => hasModuleAccess("catalog.rooms"));
  const branchOptions = ref<Array<{ label: string; value: string }>>([]);
  const roomsData = ref<CatalogRoomItem[]>([]);
  const lodgingCategories = ref<CatalogCategoryItem[]>([]);
  const pendingRooms = ref(false);
  const roomResourcesLoadedForOrganization = ref<string | null>(null);
  const currentOrganizationId = computed(() => profile.value?.organization_id ?? null);
  const roomResourcesReady = computed(() =>
    !canViewRoomCatalog.value
    || (currentOrganizationId.value !== null && roomResourcesLoadedForOrganization.value === currentOrganizationId.value),
  );
  const shouldLoadRoomResources = computed(() =>
    canViewRoomCatalog.value
    && (activeTab.value === "summary" || activeTab.value === "rooms" || activeTab.value === "room-categories"),
  );

  let roomResourcesLoader: Promise<void> | null = null;

  const roomCategories = computed(() => lodgingCategories.value);

  const filteredRoomCategories = useCatalogSearchFilter(
    roomCategories,
    searchQuery,
    (item) => [item.name, item.parentName, item.type, item.description],
  );

  const resolveErrorMessage = (error: unknown, fallback: string) => {
    if (
      error
      && typeof error === "object"
      && "statusMessage" in error
      && typeof (error as { statusMessage?: unknown }).statusMessage === "string"
    ) {
      return (error as { statusMessage: string }).statusMessage;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  };

  const openRoomModal = (room?: CatalogRoomItem) => {
    editingRoom.value = room ?? null;
    roomModalOpen.value = true;
  };

  const loadLodgingCategoriesData = async () => {
    try {
      const nextCategories = await loadLodgingCategories();
      lodgingCategories.value = nextCategories;
      return nextCategories;
    } catch {
      return [];
    }
  };

  const loadRoomsData = async () => {
    pendingRooms.value = true;
    try {
      const nextRooms = await loadRooms();
      roomsData.value = nextRooms;
      return nextRooms;
    } finally {
      pendingRooms.value = false;
    }
  };

  const ensureRoomResourcesLoaded = async (force = false) => {
    const organizationId = currentOrganizationId.value;
    if (!canViewRoomCatalog.value || !organizationId) {
      return;
    }

    if (!force && roomResourcesLoadedForOrganization.value === organizationId) {
      return;
    }

    if (!force && roomResourcesLoader) {
      await roomResourcesLoader;
      return;
    }

    roomResourcesLoader = (async () => {
      const [branchData] = await Promise.all([
        loadBranches(),
        loadRoomsData(),
        loadLodgingCategoriesData(),
      ]);

      branchOptions.value = branchData.branches.map((branch: { id: string; name: string }) => ({
        label: branch.name,
        value: branch.id,
      }));
      roomResourcesLoadedForOrganization.value = organizationId;
    })();

    try {
      await roomResourcesLoader;
    } finally {
      roomResourcesLoader = null;
    }
  };

  const handleRoomSubmit = async (payload: CatalogRoomPayload) => {
    mutationState.loading.value = true;
    mutationState.error.value = null;
    try {
      if (editingRoom.value?.id) {
        await updateRoom(editingRoom.value.id, payload);
      } else {
        await createRoom(payload);
      }
      roomModalOpen.value = false;
      editingRoom.value = null;
      await loadRoomsData();
    } catch (error) {
      mutationState.error.value = error instanceof Error ? error.message : "No se pudo guardar la habitacion.";
    } finally {
      mutationState.loading.value = false;
    }
  };

  const handleToggleRoomStatus = async ({ id, nextState }: { id: string; nextState: boolean }) => {
    mutationState.error.value = null;
    try {
      await updateRoomStatus(id, nextState);
      await loadRoomsData();
    } catch (error) {
      mutationState.error.value = resolveErrorMessage(error, "No se pudo actualizar el estado de la habitacion.");
      console.error("[CATALOGO] Room status failed:", error);
    }
  };

  watch(
    () => roomModalOpen.value,
    (open) => {
      if (!open) {
        editingRoom.value = null;
      }
    },
  );

  watch(currentOrganizationId, (nextOrganizationId, previousOrganizationId) => {
    if (nextOrganizationId === previousOrganizationId) {
      return;
    }

    roomResourcesLoadedForOrganization.value = null;
    roomResourcesLoader = null;
    branchOptions.value = [];
    roomsData.value = [];
    lodgingCategories.value = [];
  });

  watch(shouldLoadRoomResources, async (shouldLoad) => {
    if (!shouldLoad) {
      return;
    }

    await ensureRoomResourcesLoaded();
  }, { immediate: true });

  return {
    branchOptions,
    canViewRoomCatalog,
    editingRoom,
    filteredRoomCategories,
    handleRoomSubmit,
    handleToggleRoomStatus,
    loadLodgingCategoriesData,
    lodgingCategories,
    openRoomModal,
    pendingRooms,
    roomCategories,
    roomModalOpen,
    roomResourcesReady,
    roomsData,
  };
};
