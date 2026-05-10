import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, nextTick, toRaw } from "vue";
import { mount } from "@vue/test-utils";

import InventoryMovementModal from "./InventoryMovementModal.vue";
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

const UPopoverStub = defineComponent({
  props: {
    open: { type: Boolean, default: false },
  },
  emits: ["update:open"],
  setup(_, { slots }) {
    return () => h("div", [slots.default?.(), slots.content?.()]);
  },
});

const InventoryMovementLineCardStub = defineComponent({
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

function mountModal(overrides: Partial<InstanceType<typeof InventoryMovementModal>["$props"]> = {}) {
  return mount(InventoryMovementModal, {
    props: {
      open: true,
      title: "Movimiento",
      branches,
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
        UButton: UButtonStub,
        UBadge: UBadgeStub,
        UPopover: UPopoverStub,
        UIcon: true,
        InventoryMovementLineCard: InventoryMovementLineCardStub,
        AdminFormSection: AdminFormSectionStub,
        AdminReadonlyField: AdminReadonlyFieldStub,
        AdminFormActions: AdminFormActionsStub,
      },
    },
  });
}

function mountModalWithRealForm(overrides: Partial<InstanceType<typeof InventoryMovementModal>["$props"]> = {}) {
  return mount(InventoryMovementModal, {
    props: {
      open: true,
      title: "Movimiento",
      branches,
      products,
      role: "admin",
      ...overrides,
    },
    global: {
      stubs: {
        UModal: UModalStub,
        USelectMenu: USelectMenuStub,
        UTextarea: UTextareaStub,
        UButton: UButtonStub,
        UBadge: UBadgeStub,
        UPopover: UPopoverStub,
        UIcon: true,
        InventoryMovementLineCard: InventoryMovementLineCardStub,
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

async function selectBranch(wrapper: ReturnType<typeof mountModal>, branchId: string) {
  const selects = wrapper.findAll("select");
  await selects[0]!.setValue(branchId);
}

async function selectMode(wrapper: ReturnType<typeof mountModal>, mode: string) {
  const selects = wrapper.findAll("select");
  await selects[1]!.setValue(mode);
}

async function setReason(wrapper: ReturnType<typeof mountModal>, reason: string) {
  await wrapper.find("textarea").setValue(reason);
}

describe("InventoryMovementModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("autoselecciona la sucursal cuando solo hay una y el rol no es admin", async () => {
    const wrapper = mountModal({
      role: "manager",
      branches: [branches[0]!],
    });

    await setReason(wrapper, "Carga inicial");
    await wrapper.find(".pick-first-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    const emitted = wrapper.emitted("validate") as Array<[{
      branchId: string;
    }]> | undefined;
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0].branchId).toBe(branches[0]!.id);
  });

  it("precarga el producto inicial cuando se abre desde una accion contextual", async () => {
    const wrapper = mountModal({
      initialProductId: products[1]!.id,
    });

    await selectBranch(wrapper, branches[0]!.id);
    await setReason(wrapper, "Ajuste contextual");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    const emitted = wrapper.emitted("validate") as Array<[{
      lines: Array<{ productId: string }>;
    }]> | undefined;
    expect(emitted).toBeTruthy();
    expect(emitted?.[0]?.[0].lines[0]?.productId).toBe(products[1]!.id);
  });

  it("bloquea movimientos remove cuando la cantidad supera el stock disponible", async () => {
    const wrapper = mountModal();

    await selectBranch(wrapper, branches[0]!.id);
    await selectMode(wrapper, "remove");
    await setReason(wrapper, "Salida por merma");
    await wrapper.find(".pick-first-0").trigger("click");
    await wrapper.find(".set-qty-10-0").trigger("click");
    await getButtonByText(wrapper, "Confirmar movimiento masivo").trigger("click");

    expect(wrapper.emitted("submit")).toBeFalsy();
  });

  it("impide productos duplicados en lineas distintas", async () => {
    const wrapper = mountModal();

    await selectBranch(wrapper, branches[0]!.id);
    await setReason(wrapper, "Carga inicial");
    await wrapper.find(".pick-first-0").trigger("click");
    await getButtonByText(wrapper, "Agregar línea").trigger("click");
    await nextTick();
    await wrapper.find(".pick-first-1").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    expect(wrapper.emitted("validate")).toBeFalsy();
  });

  it("genera referenceCode al prevalidar y reinicia el estado al cerrar", async () => {
    const wrapper = mountModal();

    await selectBranch(wrapper, branches[0]!.id);
    await setReason(wrapper, "Ajuste por ingreso");
    await wrapper.find(".pick-first-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    const firstValidate = wrapper.emitted("validate") as Array<[{
      referenceCode?: string;
      note?: string;
    }]> | undefined;
    const payload = firstValidate?.[0]?.[0];
    expect(payload).toBeTruthy();
    if (!payload) {
      throw new Error("Expected validate payload");
    }
    expect(payload.referenceCode).toMatch(/^INV-MOV-\d{4}\/\d{4}$/);
    expect(payload.note).toBe(payload.referenceCode);
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

    await selectBranch(wrapper, branches[0]!.id);
    await selectMode(wrapper, "remove");
    await setReason(wrapper, "Salida por merma");
    await wrapper.find(".pick-first-0").trigger("click");
    await wrapper.find(".set-qty-10-0").trigger("click");
    await getButtonByText(wrapper, "Prevalidar").trigger("click");

    expect(wrapper.emitted("validate")).toBeFalsy();
  });
});
