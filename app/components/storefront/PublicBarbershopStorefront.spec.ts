import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import PublicBarbershopStorefront from "./PublicBarbershopStorefront.vue";
import type { PublicStorefrontResponse } from "@/types/storefront";

const mockLoadCatalogBySlug = vi.fn();
const mockLoadAvailabilityBySlug = vi.fn();
const mockLoadClientProfileBySlug = vi.fn();
const mockLinkClientProfileBySlug = vi.fn();
const mockCreateBookingBySlug = vi.fn();

const mockUser = ref<null | { id: string; email: string }>(null);
const mockProfile = ref<null | { full_name?: string | null }>(null);
const mockResolvedRole = ref<string | null>(null);

mockNuxtImport("usePublicBookings", () => () => ({
  loadCatalogBySlug: mockLoadCatalogBySlug,
  loadAvailabilityBySlug: mockLoadAvailabilityBySlug,
  loadClientProfileBySlug: mockLoadClientProfileBySlug,
  linkClientProfileBySlug: mockLinkClientProfileBySlug,
  createBookingBySlug: mockCreateBookingBySlug,
}));

mockNuxtImport("useAuth", () => () => ({
  user: mockUser,
  profile: mockProfile,
  resolvedRole: mockResolvedRole,
}));

const StorefrontHeadStub = defineComponent({
  props: {
    customerName: { type: String, default: "" },
    isClientReady: { type: Boolean, default: false },
  },
  setup(props) {
    return () => h("div", {
      "data-testid": "storefront-head",
      "data-ready": String(props.isClientReady),
    }, props.customerName);
  },
});

const StorefrontLoginModalStub = defineComponent({
  props: {
    open: { type: Boolean, default: false },
  },
  setup(props) {
    return () => props.open ? h("div", { "data-testid": "login-modal" }) : null;
  },
});

const storefront: PublicStorefrontResponse = {
  organization: {
    id: "org-1",
    name: "Barbers Shapa",
    slug: "demo-shop",
    logoUrl: null,
    address: null,
    currencyCode: "BOB",
    whatsapp: "67231750",
    phone: "67231750",
    email: "demo@example.com",
    country: "BO",
    instagram: null,
  },
  settings: {
    organizationId: "org-1",
    slug: "demo-shop",
    businessType: "service",
    templateKey: "service-salon",
    colorPresetKey: "warm",
    secondaryColor: "#F4EDE1",
    accentColor: "#D94B5A",
    primaryColor: "#111111",
    companyDescription: null,
    heroImageUrl: null,
    isPublished: true,
    updatedAt: null,
  },
  template: {
    key: "service-salon",
    businessType: "service",
    label: "Salon",
    shortLabel: "Salon",
    sectionTitle: "Servicios",
    description: "Plantilla salon",
    eyebrow: "Demo",
    heroTitle: "Barbers Shapa",
    heroSubtitle: "Reserva online",
    design: {
      pattern: "none",
      styleName: "Demo",
      styleKeywords: [],
      effects: [],
      headingFont: "Bodoni Moda",
      bodyFont: "sans-serif",
      recommendedColors: {
        primary: "#111111",
        secondary: "#F4EDE1",
        accent: "#D94B5A",
        background: "#070707",
        text: "#F4EDE1",
      },
    },
  },
  items: [
    {
      id: "service-1",
      title: "Corte",
      subtitle: null,
      description: "Corte clasico",
      imageUrl: null,
      badge: null,
      meta: "30 min",
      price: 20,
    },
  ],
};

const bookingCatalog = {
  organizationId: "org-1",
  organizationName: "Barbers Shapa",
  timeZone: "America/La_Paz",
  branches: [
    { id: "branch-1", name: "Central", address: null },
  ],
  services: [
    { id: "service-1", name: "Corte", description: null, durationMinutes: 30, price: 20, categoryName: null },
  ],
  employees: [
    {
      id: "employee-1",
      fullName: "Ariel Fade",
      role: "Barbero senior",
      assignedBranchIds: ["branch-1"],
      serviceIdsByBranch: { "branch-1": ["service-1"] },
    },
  ],
} as const;

const flush = async () => {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
};

function mountStorefront() {
  return mount(PublicBarbershopStorefront, {
    props: {
      storefront,
      slug: "demo-shop",
    },
    global: {
      stubs: {
        StorefrontHead: StorefrontHeadStub,
        StorefrontLoginModal: StorefrontLoginModalStub,
      },
    },
  });
}

describe("PublicBarbershopStorefront", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUser.value = null;
    mockProfile.value = null;
    mockResolvedRole.value = null;

    mockLoadCatalogBySlug.mockResolvedValue(bookingCatalog);
    mockLoadAvailabilityBySlug.mockResolvedValue({ date: "2026-06-28", slots: [] });
    mockLoadClientProfileBySlug.mockResolvedValue(null);
    mockLinkClientProfileBySlug.mockResolvedValue({
      clientId: "client-1",
      fullName: "Demo Client",
      phone: "7777777",
      email: "demo@example.com",
      orgStatus: "active",
    });
    mockCreateBookingBySlug.mockResolvedValue(null);
  });

  it("muestra acceso requerido cuando no hay sesion", async () => {
    const wrapper = mountStorefront();
    await flush();

    expect(wrapper.text()).toContain("Inicia sesion o registrate para agendar");
  });

  it("muestra linking cuando hay sesion pero no perfil cliente", async () => {
    mockUser.value = { id: "user-1", email: "demo@example.com" };
    mockProfile.value = { full_name: "Demo Client" };

    const wrapper = mountStorefront();
    await flush();

    expect(wrapper.text()).toContain("Vincula tu cuenta como cliente");
    expect(wrapper.text()).toContain("Solo necesitamos tus datos base para habilitar reservas en esta tienda.");
  });

  it("bloquea una sesion staff aunque no exista perfil cliente", async () => {
    mockUser.value = { id: "user-1", email: "staff@example.com" };
    mockProfile.value = { full_name: "Demo Staff" };
    mockResolvedRole.value = "employee";

    const wrapper = mountStorefront();
    await flush();

    expect(wrapper.text()).toContain("Tu cuenta no puede reservar en esta tienda");
    expect(wrapper.text()).not.toContain("Vincula tu cuenta como cliente");
  });

  it("muestra bloqueo cuando el perfil cliente no esta activo", async () => {
    mockUser.value = { id: "user-1", email: "demo@example.com" };
    mockProfile.value = { full_name: "Demo Client" };
    mockLoadClientProfileBySlug.mockResolvedValue({
      clientId: "client-1",
      fullName: "Demo Client",
      phone: "7777777",
      email: "demo@example.com",
      orgStatus: "blocked",
    });

    const wrapper = mountStorefront();
    await flush();

    expect(wrapper.text()).toContain("Tu cuenta no puede reservar en esta tienda");
  });

  it("muestra formulario de reserva cuando el perfil cliente esta activo", async () => {
    mockUser.value = { id: "user-1", email: "demo@example.com" };
    mockProfile.value = { full_name: "Demo Client" };
    mockLoadClientProfileBySlug.mockResolvedValue({
      clientId: "client-1",
      fullName: "Demo Client",
      phone: "7777777",
      email: "demo@example.com",
      orgStatus: "active",
    });

    const wrapper = mountStorefront();
    await flush();

    expect(wrapper.text()).toContain("Reservando como");
    expect(wrapper.text()).toContain("Confirmar reserva");
  });
});
