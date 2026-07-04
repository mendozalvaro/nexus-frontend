import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

const { mockNavigateTo } = vi.hoisted(() => ({
  mockNavigateTo: vi.fn(),
}));

const mockSignIn = vi.fn();

const mockSession = ref<{ user: null | { id: string } }>({
  user: null,
});

mockNuxtImport("navigateTo", () => mockNavigateTo);

mockNuxtImport("useSupabaseSession", () => () => mockSession);
mockNuxtImport("useAuth", () => () => ({
  signIn: mockSignIn,
  isLoading: ref(false),
  isSubmitting: ref(false),
  error: ref(null),
}));
mockNuxtImport("useAuthRateLimit", () => () => ({
  attemptCount: ref(0),
  isRateLimited: ref(false),
  shouldShowWarning: ref(false),
  shouldShowCaptchaPlaceholder: ref(false),
  warningMessage: ref(null),
  rateLimitMessage: ref(null),
  registerFailure: vi.fn(),
  reset: vi.fn(),
}));

const UCardStub = defineComponent({
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
  },
});

const UAlertStub = defineComponent({
  props: {
    title: { type: String, default: "" },
  },
  setup(props) {
    return () => h("div", props.title);
  },
});

const UFormStub = defineComponent({
  props: {
    state: { type: Object, required: true },
  },
  emits: ["submit"],
  setup(props, { emit, slots }) {
    return () => h("form", {
      onSubmit: (event: Event) => {
        event.preventDefault();
        emit("submit", {
          preventDefault: vi.fn(),
          data: {
            email: (props.state as Record<string, unknown>).email,
            password: (props.state as Record<string, unknown>).password,
            remember: (props.state as Record<string, unknown>).remember,
          },
        });
      },
    }, slots.default?.());
  },
});

const UFormFieldStub = defineComponent({
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
  },
});

const UInputStub = defineComponent({
  props: {
    modelValue: { type: String, default: "" },
    type: { type: String, default: "text" },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  setup(props, { emit, slots }) {
    return () => h("div", [
      h("input", {
        value: props.modelValue,
        type: props.type,
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value),
      }),
      slots.trailing?.(),
    ]);
  },
});

const UCheckboxStub = defineComponent({
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => h("input", {
      type: "checkbox",
      checked: props.modelValue,
      disabled: props.disabled,
      onChange: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).checked),
    });
  },
});

const UButtonStub = defineComponent({
  props: {
    type: { type: String, default: "button" },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => h("button", {
      type: props.type,
      disabled: props.disabled,
    }, slots.default?.());
  },
});

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.value = { user: null };
    mockNavigateTo.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue({
      data: { access_token: "token-123" },
      error: null,
    });
  });

  it("redirige al callback staff preservando redirect cuando el login por password es valido", async () => {
    const LoginForm = (await import("./LoginForm.vue")).default;
    const wrapper = mount(LoginForm, {
      props: {
        redirect: "/inventory",
      },
      global: {
        stubs: {
          SocialLoginButtons: true,
          NuxtLink: true,
          UCard: UCardStub,
          UAlert: UAlertStub,
          UForm: UFormStub,
          UFormField: UFormFieldStub,
          UInput: UInputStub,
          UCheckbox: UCheckboxStub,
          UButton: UButtonStub,
        },
      },
    });

    const inputs = wrapper.findAll("input");
    await inputs[0]!.setValue("cliente.servicios@nexuspos.demo");
    await inputs[1]!.setValue("Demo123456!");
    await wrapper.find("form").trigger("submit");
    await nextTick();
    await nextTick();

    expect(mockSignIn).toHaveBeenCalledWith(
      "cliente.servicios@nexuspos.demo",
      "Demo123456!",
      { resolveProfile: false },
    );
    expect(mockNavigateTo).toHaveBeenCalledWith(
      "/auth/callback?audience=staff&redirect=%2Finventory",
      { replace: true },
    );
    expect(wrapper.text()).not.toContain("Esta cuenta no tiene acceso al panel interno.");
  }, 15_000);
});
