import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

const mockResolveStorefrontAccessToken = vi.fn();
const mockFetch = vi.fn();

vi.stubGlobal("$fetch", mockFetch);

mockNuxtImport("useStorefrontAuth", () => () => ({
  resolveStorefrontAccessToken: mockResolveStorefrontAccessToken,
}));

describe("usePublicBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveStorefrontAccessToken.mockResolvedValue("token-123");
  });

  it("consulta /me sin auto-link y preserva bearer token", async () => {
    mockFetch.mockResolvedValue(null);

    const { usePublicBookings } = await import("../usePublicBookings");
    const { loadClientProfileBySlug } = usePublicBookings();

    await loadClientProfileBySlug(" Demo-Shop ");

    expect(mockFetch).toHaveBeenCalledWith("/api/public/bookings/demo-shop/me", {
      headers: {
        Authorization: "Bearer token-123",
      },
    });
  });

  it("envia linking explicito al endpoint client-link", async () => {
    mockFetch.mockResolvedValue({
      clientId: "client-1",
      fullName: "Demo Client",
      phone: "7777777",
      email: "demo@example.com",
      orgStatus: "active",
    });

    const { usePublicBookings } = await import("../usePublicBookings");
    const { linkClientProfileBySlug } = usePublicBookings();

    await linkClientProfileBySlug(" Demo-Shop ", {
      firstName: "Demo",
      lastName: "Client",
      phone: "7777777",
      email: "demo@example.com",
      preferences: {
        booking_channel: "storefront",
      },
      billingData: {
        source: "public_storefront_auth",
      },
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/public/bookings/demo-shop/client-link", {
      method: "POST",
      body: {
        firstName: "Demo",
        lastName: "Client",
        phone: "7777777",
        email: "demo@example.com",
        preferences: {
          booking_channel: "storefront",
        },
        billingData: {
          source: "public_storefront_auth",
        },
      },
      headers: {
        Authorization: "Bearer token-123",
      },
    });
  });
});
