import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const {
  mockResolveActorContext,
  mockNavigateTo,
} = vi.hoisted(() => ({
  mockResolveActorContext: vi.fn(),
  mockNavigateTo: vi.fn((target: string) => target),
}));

mockNuxtImport("useActorContext", () => () => ({
  resolveActorContext: mockResolveActorContext,
}));

mockNuxtImport("navigateTo", () => mockNavigateTo);

describe("system-only middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();
  });

  it("manda a login con redirect preservado si no hay sesion", async () => {
    mockResolveActorContext.mockResolvedValue({
      user: null,
      actorType: "guest",
    });

    const middleware = (await import("../system-only")).default;
    const result = await middleware({ fullPath: "/system/users" } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/auth/login?redirect=%2Fsystem%2Fusers");
    expect(result).toBe("/auth/login?redirect=%2Fsystem%2Fusers");
  });

  it("permite acceso a usuario system activo", async () => {
    mockResolveActorContext.mockResolvedValue({
      user: { id: "system-user-1" },
      actorType: "system",
      profile: null,
    });

    const middleware = (await import("../system-only")).default;
    const result = await middleware({ fullPath: "/system" } as never, {} as never);

    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it("redirige usuario autenticado no-system a home de su rol", async () => {
    mockResolveActorContext.mockResolvedValue({
      user: { id: "admin-user-1" },
      actorType: "staff",
      profile: {
        role: "admin",
      },
    });

    const middleware = (await import("../system-only")).default;
    const result = await middleware({ fullPath: "/system/profile" } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/dashboard");
    expect(result).toBe("/dashboard");
  });
});
