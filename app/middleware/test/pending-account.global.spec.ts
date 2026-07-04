import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const {
  mockNavigateTo,
  mockUseUserContext,
} = vi.hoisted(() => ({
  mockNavigateTo: vi.fn((target: string) => target),
  mockUseUserContext: vi.fn(),
}));

mockNuxtImport("navigateTo", () => mockNavigateTo);
mockNuxtImport("useUserContext", () => mockUseUserContext);

describe("pending-account.global middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();

    mockUseUserContext.mockReturnValue({
      accountStatus: { value: "active" },
      paymentRequired: false,
      contextBootstrapState: { value: "authenticated" },
    });
  });

  it("permite dashboard cuando la cuenta requiere pago", async () => {
    mockUseUserContext.mockReturnValue({
      accountStatus: { value: "pending" },
      paymentRequired: true,
      contextBootstrapState: { value: "authenticated" },
    });

    const middleware = (await import("../pending-account.global")).default;
    const result = await middleware({ path: "/dashboard", fullPath: "/dashboard", meta: {} } as never, {} as never);

    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it("redirige a pago cuando intenta entrar a un modulo bloqueado", async () => {
    mockUseUserContext.mockReturnValue({
      accountStatus: { value: "pending" },
      paymentRequired: true,
      contextBootstrapState: { value: "authenticated" },
    });

    const middleware = (await import("../pending-account.global")).default;
    const result = await middleware({ path: "/pos/sell", fullPath: "/pos/sell", meta: {} } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/onboarding/payment");
    expect(result).toBe("/onboarding/payment");
  });

  it("no redirige mientras el contexto aun esta resolviendo", async () => {
    mockUseUserContext.mockReturnValue({
      accountStatus: { value: "pending" },
      paymentRequired: true,
      contextBootstrapState: { value: "resolving" },
    });

    const middleware = (await import("../pending-account.global")).default;
    const result = await middleware({ path: "/pos/sell", fullPath: "/pos/sell", meta: {} } as never, {} as never);

    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it("solo permite rutas explicitas de onboarding para cuenta pendiente", async () => {
    mockUseUserContext.mockReturnValue({
      accountStatus: { value: "pending" },
      paymentRequired: true,
      contextBootstrapState: { value: "authenticated" },
    });

    const middleware = (await import("../pending-account.global")).default;
    const result = await middleware({ path: "/onboarding/organization", fullPath: "/onboarding/organization", meta: {} } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/onboarding/payment");
    expect(result).toBe("/onboarding/payment");
  });
});
