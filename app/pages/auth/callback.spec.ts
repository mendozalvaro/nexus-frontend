import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

const {
  mockRouterReplace,
  mockResolvePostAuthDestination,
  mockNavigateTo,
  mockWaitForAuthenticatedUser,
  mockRouterBeforeEach,
  mockRouterAfterEach,
  mockRouterBeforeResolve,
  mockRouterOnError,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockResolvePostAuthDestination: vi.fn(),
  mockNavigateTo: vi.fn(),
  mockWaitForAuthenticatedUser: vi.fn(),
  mockRouterBeforeEach: vi.fn(),
  mockRouterAfterEach: vi.fn(),
  mockRouterBeforeResolve: vi.fn(),
  mockRouterOnError: vi.fn(),
}));

const mockRoute = ref({
  query: {} as Record<string, unknown>,
});

mockNuxtImport("useRouter", () => () => ({
  replace: mockRouterReplace,
  beforeEach: mockRouterBeforeEach,
  afterEach: mockRouterAfterEach,
  beforeResolve: mockRouterBeforeResolve,
  onError: mockRouterOnError,
}));

mockNuxtImport("useRoute", () => () => mockRoute.value);
mockNuxtImport("navigateTo", () => mockNavigateTo);
mockNuxtImport("useSessionAccess", () => () => ({
  waitForAuthenticatedUser: mockWaitForAuthenticatedUser,
}));
mockNuxtImport("usePostAuthResolution", () => () => ({
  resolvePostAuthDestination: mockResolvePostAuthDestination,
}));

const AuthLayoutStub = defineComponent({
  props: {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
  },
});

const flush = async () => {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
};

describe("auth callback page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockRoute.value = { query: {} };
    mockWaitForAuthenticatedUser.mockResolvedValue(null);
    mockResolvePostAuthDestination.mockResolvedValue({
      destination: "/dashboard",
      reason: "active",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirige staff al destino resuelto", async () => {
    mockRoute.value = {
      query: {
        audience: "staff",
        redirect: "/inventory",
      },
    };
    mockWaitForAuthenticatedUser.mockResolvedValue({ id: "staff-1", email: "staff@nexus.com" });

    const Page = (await import("./callback.vue")).default;
    mount(Page, {
      global: {
        stubs: {
          AuthLayout: AuthLayoutStub,
          UCard: true,
          UIcon: true,
          UAlert: true,
          NuxtLink: true,
        },
      },
    });
    await flush();

    expect(mockResolvePostAuthDestination).toHaveBeenCalledWith({
      audience: "staff",
      redirect: "/inventory",
      slug: null,
      user: { id: "staff-1", email: "staff@nexus.com" },
    });
    expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("muestra rechazo controlado para audiencia client sin acceso", async () => {
    mockRoute.value = {
      query: {
        audience: "client",
        redirect: "/demo-shop",
        slug: "demo-shop",
      },
    };
    mockWaitForAuthenticatedUser.mockResolvedValue({ id: "staff-1", email: "staff@nexus.com" });
    mockResolvePostAuthDestination.mockResolvedValue({
      destination: "/demo-shop",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso como cliente a esta tienda.",
    });

    const Page = (await import("./callback.vue")).default;
    const wrapper = mount(Page, {
      global: {
        stubs: {
          AuthLayout: AuthLayoutStub,
          UCard: defineComponent({ setup(_, { slots }) { return () => h("div", slots.default?.()); } }),
          UIcon: true,
          UAlert: defineComponent({
            props: { title: { type: String, default: "" } },
            setup(props) {
              return () => h("div", props.title);
            },
          }),
          NuxtLink: defineComponent({
            props: { to: { type: String, default: "" } },
            setup(_, { slots }) {
              return () => h("a", slots.default?.());
            },
          }),
        },
      },
    });
    await flush();

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Acceso rechazado para este flujo.");
    expect(wrapper.text()).toContain("Esta cuenta no tiene acceso como cliente a esta tienda.");
  });

  it("vuelve al origen correcto si no aparece sesion tras timeout", async () => {
    mockRoute.value = {
      query: {
        audience: "client",
        redirect: "/demo-shop",
        slug: "demo-shop",
      },
    };

    const Page = (await import("./callback.vue")).default;
    mount(Page, {
      global: {
        stubs: {
          AuthLayout: AuthLayoutStub,
          UCard: true,
          UIcon: true,
          UAlert: true,
          NuxtLink: true,
        },
      },
    });

    await flush();

    expect(mockResolvePostAuthDestination).not.toHaveBeenCalled();
    expect(mockNavigateTo).toHaveBeenCalledWith("/demo-shop", { replace: true });
  });
});
