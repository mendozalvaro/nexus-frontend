import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import ReservationStayActionModal from "./ReservationStayActionModal.vue";

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

const UFormFieldStub = defineComponent({
  props: { label: { type: String, default: "" } },
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
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
        onChange: (event: Event) => emit("update:modelValue", (event.target as HTMLSelectElement).value),
      },
      (props.items as Array<Record<string, string>>).map((item) =>
        h("option", { value: item[props.valueKey] }, item[props.labelKey]),
      ),
    );
  },
});

const UInputStub = defineComponent({
  props: {
    modelValue: { type: String, default: "" },
    type: { type: String, default: "text" },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => h("input", {
      value: props.modelValue,
      type: props.type,
      onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value),
    });
  },
});

const UTextareaStub = defineComponent({
  props: { modelValue: { type: String, default: "" } },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => h("textarea", {
      value: props.modelValue,
      onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLTextAreaElement).value),
    });
  },
});

const UButtonStub = defineComponent({
  props: {
    disabled: { type: Boolean, default: false },
  },
  emits: ["click"],
  setup(props, { slots, emit }) {
    return () => h("button", { disabled: props.disabled, onClick: () => emit("click") }, slots.default?.());
  },
});

function mountModal(props: Partial<InstanceType<typeof ReservationStayActionModal>["$props"]> = {}) {
  return mount(ReservationStayActionModal, {
    props: {
      open: true,
      loading: false,
      status: "checked_in",
      isOpenEnded: false,
      currentCheckOut: "2026-06-15",
      ...props,
    },
    global: {
      stubs: {
        UModal: UModalStub,
        UFormField: UFormFieldStub,
        USelectMenu: USelectMenuStub,
        UInput: UInputStub,
        UTextarea: UTextareaStub,
        UButton: UButtonStub,
      },
    },
  });
}

describe("ReservationStayActionModal", () => {
    it("muestra opciones de extension para estadias activas", () => {
    const wrapper = mountModal({ status: "checked_in", isOpenEnded: false });
    const options = wrapper.findAll("option").map((option) => option.text());

    expect(options).toEqual(["Solo check-out", "Alargar estadía", "Marcar indefinida"]);
  });

  it("exige nueva fecha al alargar estadía", async () => {
    const wrapper = mountModal({ status: "checked_in", isOpenEnded: false, currentCheckOut: "" });

    await wrapper.find("select").setValue("extend_stay");
    await nextTick();

    const buttons = wrapper.findAll("button");
    expect(buttons[1]?.attributes("disabled")).toBeDefined();
  });

  it("emite payload open ended al marcar indefinida", async () => {
    const wrapper = mountModal({ status: "checked_in", isOpenEnded: false });

    await wrapper.find("select").setValue("mark_open_ended");
    await nextTick();
    await wrapper.findAll("button")[1]!.trigger("click");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      action: "extend_stay",
      openEnded: true,
    });
  });
});


