import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const {
  mockNavigateTo,
  mockResolveActorContext,
  mockLoadAccountStatus,
} = vi.hoisted(() => ({
  mockNavigateTo: vi.fn((target: string) => target),
  mockResolveActorContext: vi.fn(),
  mockLoadAccountStatus: vi.fn(),
}));

mockNuxtImport("navigateTo", () => mockNavigateTo);
mockNuxtImport("useActorContext", () => () => ({
  resolveActorContext: mockResolveActorContext,
}));
mockNuxtImport("useAccountStatus", () => () => ({
  loadAccountStatus: mockLoadAccountStatus,
}));

describe("account-status middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();
  });

  it("redirige al dashboard cuando la cuenta ya esta activa", async () => {
    mockResolveActorContext.mockResolvedValue({
      user: { id: "staff-user-1" },
      actorType: "staff",
      profile: {
        organization_id: "org-123",
        role: "admin",
      },
    });
    mockLoadAccountStatus.mockResolvedValue({
      accountStatus: "active",
      snapshot: {
        latestValidationStatus: "pending",
      },
    });

    const middleware = (await import("../account-status")).default;
    const result = await middleware({ fullPath: "/onboarding/payment" } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/dashboard");
    expect(result).toBe("/dashboard");
  });
});
