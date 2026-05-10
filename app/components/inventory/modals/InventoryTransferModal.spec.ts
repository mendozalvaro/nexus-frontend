import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, nextTick, toRaw } from "vue";
import { mount } from "@vue/test-utils";

import InventoryTransferModal from "./InventoryTransferModal.vue";
import type { InventoryBranchOption, InventoryProductRowView } from "@/utils/inventory";

const UModalStub = defineComponent({
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  emits: ["update:open"],
  setup(props, { slots }) {
    return () => props.open
      ? h("div", { "data-testid": "modal" }, [
          h("h1", props.title),
          h("p", props.description),
          slots.body?.(),
          slots.footer?.(),
        ])
      : null;
  },
});

const UFormStub = defineComponent({
  props: {
    schema: { type: Object, required: true },
    state: { type: Object, required: true },
  },
  setup(props, { expose, slots }) {
    expose({
      validate: async () => {
        const result = (props.schema as { safeParse: (value: unknown) => { success: boolean; data?: unknown } })
          .safeParse(toRaw(props.state));
        return result.success ? result.data : false;
      },
      clear: () => undefined,
    });

    return () => h("form", slots.default?.());
  },
});

const UFormFieldStub = defineComponent({
  props: {
    label: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => h("div", { "data-field-name": props.name }, slots.default?.());
  },
});

const USelectMenuStub = defineComponent({
  props: {
    modelValue: { type: String, default: "" },
    items: { type: Array, default: () => [] },
    valueKey: { type: String, default: "value" },
    labelKey: { type: String, default: "label" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => h(
      "select",
      {
        value: props.modelValue,
        onChange: (event: Event) => {
          emit("update:modelValue", (event.target as HTMLSelectElement).value);
        },
      },
      (props.items as Array<Record<string, string>>).map((item) =>
        h("option", { value: item[props.valueKey] ?? item.value }, item[props.labelKey] ?? item.label),
      ),
    );
  },
});

const UTextareaStub = defineComponent({
  props: {
    modelValue: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => h("textarea", {
      value: props.modelValue,
      onInput: (event: Event) => {
        emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
      },
    });
  },
});

const UInputStub = defineComponent({
  props: {
    modelValue: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => h("input", {
      value: props.modelValue,
      disabled: props.disabled,
      readonly: props.readonly,
      onInput: (event: Event) => {
        emit("update:modelValue", (event.target as HTMLInputElement).value);
      },
    });
  },
});

const UButtonStub = defineComponent({
  props: {
    label: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  emits: ["click"],
  setup(props, { slots, emit }) {
    return () => h("button", {
      disabled: props.disabled,
      onClick: () => emit("click"),
    }, slots.default?.() ?? props.label);
  },
});

const UBadgeStub = defineComponent({
  setup(_, { slots }) {
    return () => h("span", { "data-testid": "badge" }, slots.default?.());
  },
});

const InventoryTransferLineCardStub = defineComponent({
  props: {
    line: { type: Object, required: true },
    lineIndex: { type: Number, required: true },
    products: { type: Array, default: () => [] },
  },
  emits: ["remove", "update:product-id"],
  setup(props, { emit, expose }) {
    expose({ closeDropdown: () => undefined });

    return () => h("div", { "data-testid": `line-${props.lineIndex}` }, [
      h("div", `line-${props.lineIndex}`),
      h("button", {
        class: `pick-first-${props.lineIndex}`,
        onClick: () => emit("update:product-id", (props.products as InventoryProductRowView[])[0]?.id ?? ""),
      }, "pick-first"),
      h("button", {
        class: `pick-second-${props.lineIndex}`,
        onClick: () => emit("update:product-id", (props.products as InventoryProductRowView[])[1]?.id ?? ""),
      }, "pick-second"),
      h("button", {
        class: `set-qty-10-${props.lineIndex}`,
        onClick: () => {
          (props.line as { quantity: number }).quantity = 10;
        },
      }, "qty-10"),
    ]);
  },
});

const AdminFormSectionStub = defineComponent({
  setup(_, { slots }) {
    return () => h("section", [slots.badge?.(), slots.default?.()]);
  },
});

const AdminReadonlyFieldStub = defineComponent({
  props: {
    value: { type: String, default: "" },
  },
  setup(props) {
    return () => h("div", props.value);
  },
});

const AdminFormActionsStub = defineComponent({
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
  },
});

const branches: InventoryBranchOption[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Central", code: "CEN", address: null, isActive: true },
  { id: "22222222-2222-2222-2222-222222222222", name: "Norte", code: "NOR", address: null, isActive: true },
];

const products: InventoryProductRowView[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    organizationId: "org-1",
    name: "Producto A",
    sku: "A-01",
    description: null,
    categoryId: null,
    categoryName: "Cat A",
    costPrice: 10,
    salePrice: 20,
    trackInventory: true,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    stockByBranch: [
      {
        stockId: "s1",
        branchId: branches[0]!.id,
        branchName: "Central",
        branchCode: "CEN",
        quantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
        minStockLevel: 2,
        isLowStock: false,
        updatedAt: null,
      },
    ],
    totalQuantity: 5,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 5,
    lowStockBranchesCount: 0,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    organizationId: "org-1",
    name: "Producto B",
    sku: "B-01",
    description: null,
    categoryId: null,
    categoryName: "Cat B",
    costPrice: 5,
    salePrice: 12,
    trackInventory: true,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    stockByBranch: [
      {
        stockId: "s2",
        branchId: branches[0]!.id,
        branchName: "Central",
        branchCode: "CEN",
        quantity: 3,
        reservedQuantity: 0,
        availableQuantity: 3,
        minStockLevel: 1,
        isLowStock: false,
        updatedAt: null,
      },
    ],
    totalQuantity: 3,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 3,
    lowStockBranchesCount: 0,
  },
];

function mountModal(overrides: Partial<InstanceType<typeof InventoryTransferModal>["$props"]> = {}) {
  return mount(InventoryTransferModal, {
    props: {
      open: true,
      title: "Transferencia",
      branches,
      allBranches: branches,
      products,
      role: "admin",
      ...overrides,
    },
    global: {
      stubs: {
        UModal: UModalStub,
        UForm: UFormStub,
        UFormField: UFormFieldStub,
        USelectMenu: USelectMenuStub,
        UTextarea: UTextareaStub,
        UInput: UInputStub,
        UButton: UButtonStub,
        UBadge: UBadgeStub,
        UIcon: true,
        InventoryTransferLineCard: InventoryTransferLineCardStub,
        AdminFormSection: AdminFormSectionStub,
        AdminReadonlyField: AdminReadonlyFieldStub,
        AdminFormActions: AdminFormActionsStub,
      },
    },
  });
}

function mountModalWithRealForm(overrides: Partial<InstanceType<typeof InventoryTransferModal>["$props"]> = {}) {
  return mount(InventoryTransferModal, {
    props: {
      open: true,
      title: "Transferencia",
      branches,
      allBranches: branches,
      products,
      role: "admin",
      ...overrides,
    },
    global: {
      stubs: {
        UModal: UModalStub,
        USelectMenu: USelectMenuStub,
        UTextarea: UTextareaStub,
        UInput: UInputStub,
        UButton: UButtonStub,
        UBadge: UBadgeStub,
        UIcon: true,
        InventoryTransferLineCard: InventoryTransferLineCardStub,
        AdminFormSection: AdminFormSectionStub,
        AdminReadonlyField: AdminReadonlyFieldStub,
        AdminFormActions: AdminFormActionsStub,
      },
    },
  });
}

function getButtonByText(wrapper: ReturnType<typeof mountModal>, text: string) {
  const button = wrapper.findAll("button").find((node) => node.text() === text);
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
}

async function selectSourceBranch(wrapper: ReturnType<typeof mountModal>, branchId: string) {
  const selects = wrapper.findAll("select");
  await selects[0]!.setValue(branchId);
}

async function selectDestinationBranch(wrapper: ReturnType<typeof mountModal>, branchId: string) {
  const selects = wrapper.findAll("select");
  await selects[selects.length - 1]!.setValue(branchId);
}

async function setObservations(wrapper: ReturnType<typeof mountModal>, observations: string) {
  await wrapper.find("textarea").setValue(observations);
}

describe("InventoryTransferModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("autoselecciona la sucursal origen cuando solo hay una y el rol no es admin", async () => {
    const wrapper = mountModal({
      role: "manager",
      branches: [branches[0]!],
      allBranches: branches,
    });

    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Reposicion entre sucursales");
    await wrapper.find(".pick-first-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    const emitted = wrapper.emitted("validate") as Array<[{
      sourceBranchId: string;
    }]> | undefined;
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0].sourceBranchId).toBe(branches[0]!.id);
  });

  it("limpia el destino si el origen cambia a la misma sucursal y bloquea el submit", async () => {
    const wrapper = mountModal();

    await selectSourceBranch(wrapper, branches[0]!.id);
    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Movimiento interno");
    await wrapper.find(".pick-first-0").trigger("click");
    await selectSourceBranch(wrapper, branches[1]!.id);
    await getButtonByText(wrapper, "Seleccionar sucursales").trigger("click");

    expect(wrapper.emitted("submit")).toBeFalsy();
  });

  it("bloquea cantidades que superan el stock disponible en origen", async () => {
    const wrapper = mountModal();

    await selectSourceBranch(wrapper, branches[0]!.id);
    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Reposicion urgente");
    await wrapper.find(".pick-first-0").trigger("click");
    await wrapper.find(".set-qty-10-0").trigger("click");
    await getButtonByText(wrapper, "Crear transferencia masiva").trigger("click");

    expect(wrapper.emitted("submit")).toBeFalsy();
  });

  it("bloquea productos sin stock configurado en la sucursal origen", async () => {
    const wrapper = mountModal({
      products: [
        products[0]!,
        {
          ...products[1]!,
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          name: "Producto sin stock origen",
          sku: "C-01",
          stockByBranch: [
            {
              stockId: "s3",
              branchId: branches[1]!.id,
              branchName: "Norte",
              branchCode: "NOR",
              quantity: 7,
              reservedQuantity: 0,
              availableQuantity: 7,
              minStockLevel: 2,
              isLowStock: false,
              updatedAt: null,
            },
          ],
          totalQuantity: 7,
          totalReservedQuantity: 0,
          totalAvailableQuantity: 7,
          lowStockBranchesCount: 0,
        },
        products[1]!,
      ],
    });

    await selectSourceBranch(wrapper, branches[0]!.id);
    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Reposicion con stock faltante");
    await wrapper.find(".pick-second-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    expect(wrapper.emitted("validate")).toBeFalsy();
  });

  it("impide productos duplicados en lineas distintas", async () => {
    const wrapper = mountModal();

    await selectSourceBranch(wrapper, branches[0]!.id);
    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Reposicion general");
    await wrapper.find(".pick-first-0").trigger("click");
    await getButtonByText(wrapper, "Agregar línea").trigger("click");
    await nextTick();
    await wrapper.find(".pick-first-1").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    expect(wrapper.emitted("validate")).toBeFalsy();
  });

  it("genera codigo provisional y reinicia el estado al cerrar", async () => {
    const wrapper = mountModal();

    await selectSourceBranch(wrapper, branches[0]!.id);
    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Reposicion general");
    await wrapper.find(".pick-first-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    const firstValidate = wrapper.emitted("validate") as Array<[{
      referenceCode?: string;
    }]> | undefined;
    const payload = firstValidate?.[0]?.[0];
    expect(payload).toBeTruthy();
    expect(payload?.referenceCode).toMatch(/^INV-TRA-\d{4}\/\d{4}$/);
    expect(wrapper.text()).toContain("Provisional:");

    await getButtonByText(wrapper, "Cancelar").trigger("click");
    expect(wrapper.emitted("update:open")?.at(-1)?.[0]).toBe(false);

    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    await nextTick();

    expect(wrapper.text()).not.toContain("Provisional:");
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toBe("");
  });

  it("valida con UForm real y no emite prevalidacion si el schema falla", async () => {
    const wrapper = mountModalWithRealForm();

    await selectSourceBranch(wrapper, branches[0]!.id);
    await selectDestinationBranch(wrapper, branches[1]!.id);
    await setObservations(wrapper, "Reposicion urgente");
    await wrapper.find(".pick-first-0").trigger("click");
    await wrapper.find(".set-qty-10-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    expect(wrapper.emitted("validate")).toBeFalsy();
  });
});
