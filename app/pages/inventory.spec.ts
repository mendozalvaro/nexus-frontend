import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

const handleTransferValidate = vi.fn();
const handleTransferSubmit = vi.fn();

mockNuxtImport("useInventoryPage", () => () => ({
  activeTab: ref<"summary" | "stock" | "movements">("stock"),
  stockQuery: ref(""),
  movementModalOpen: ref(false),
  transferModalOpen: ref(true),
  movementLoading: ref(false),
  transferLoading: ref(false),
  selectedProductId: ref<string | null>(null),
  movementDetailsModalOpen: ref(false),
  selectedMovementDetails: ref(null),
  selectedTransferDetails: ref(null),
  movementPrecheckErrors: ref([]),
  transferPrecheckErrors: ref([]),
  movementPrecheckNormalization: ref(null),
  transferPrecheckNormalization: ref(null),
  movementPrecheckWarnings: ref([]),
  transferPrecheckWarnings: ref([]),
  actorRole: ref<"admin" | "manager">("admin"),
  selectedBranchId: ref<string | null>(null),
  overviewPending: ref(false),
  movementsPending: ref(false),
  overview: ref({ products: [], branches: [] }),
  transferState: ref(null),
  movementState: ref(null),
  activeBranches: ref([]),
  activeBranchIds: ref([]),
  allBranches: ref([]),
  showStockBranchesColumn: ref(false),
  stockRows: ref([]),
  movementFilters: ref({}),
  movementDateFrom: ref(""),
  movementDateTo: ref(""),
  movementBranchModel: ref("__all__"),
  movementProductModel: ref("__all__"),
  movementTypeOptions: [],
  movementBranchOptions: [],
  movementProductOptions: [],
  pendingStockReceipts: ref([]),
  metrics: ref([]),
  openMovementModal: vi.fn(),
  openTransferModal: vi.fn(),
  canReceiveTransfer: vi.fn(),
  canRejectTransfer: vi.fn(),
  handleMovementValidate: vi.fn(),
  handleMovementSubmit: vi.fn(),
  handleTransferValidate,
  handleTransferSubmit,
  handleReceiveTransfer: vi.fn(),
  handleRejectTransfer: vi.fn(),
  handleViewMovementDetails: vi.fn(),
  movementDetailTitle: ref("Detalle"),
  goToStockFromAlert: vi.fn(),
  formatDateTime: vi.fn(),
  getMovementLabel: vi.fn(),
  getMovementColor: vi.fn(),
}));

const TransferModalStub = defineComponent({
  emits: ["validate", "submit", "update:open"],
  setup(_, { emit }) {
    return () => h("div", [
      h("button", { class: "emit-validate", onClick: () => emit("validate", { batch: "validate" }) }, "validate"),
      h("button", { class: "emit-submit", onClick: () => emit("submit", { batch: "submit" }) }, "submit"),
    ]);
  },
});

describe("inventory page wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("separa validate y submit del modal de transferencias", async () => {
    const Page = (await import("./inventory.vue")).default;

    const wrapper = mount(Page, {
      global: {
        stubs: {
          InventorySummaryTab: true,
          InventoryStockTab: true,
          InventoryMovementsTab: true,
          InventoryMovementModal: true,
          InventoryTransferModal: TransferModalStub,
          InventoryMovementDetailsModal: true,
          UButton: defineComponent({
            setup(_, { slots }) {
              return () => h("button", slots.default?.());
            },
          }),
        },
      },
    });

    await wrapper.find(".emit-validate").trigger("click");
    await wrapper.find(".emit-submit").trigger("click");

    expect(handleTransferValidate).toHaveBeenCalledWith({ batch: "validate" });
    expect(handleTransferSubmit).toHaveBeenCalledWith({ batch: "submit" });
  });
});
