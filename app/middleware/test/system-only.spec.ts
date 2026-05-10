import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const {
  mockEnsureAuthContext,
  mockEnsureContext,
  mockMaybeSingle,
  mockFrom,
  mockNavigateTo,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));

  return {
    mockEnsureAuthContext: vi.fn(),
    mockEnsureContext: vi.fn(),
    mockMaybeSingle,
    mockEq,
    mockSelect,
    mockFrom,
    mockNavigateTo: vi.fn((target: string) => target),
  };
});

mockNuxtImport("useAuthContext", () => () => ({
  ensureAuthContext: mockEnsureAuthContext,
}));

mockNuxtImport("useUserContext", () => () => ({
  profile: ref(null),
  ensureContext: mockEnsureContext,
}));

mockNuxtImport("useSupabaseClient", () => () => ({
  from: mockFrom,
}));

mockNuxtImport("navigateTo", () => mockNavigateTo);

describe("system-only middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();
  });

  it("manda a login con redirect preservado si no hay sesion", async () => {
    mockEnsureAuthContext.mockResolvedValue({ user: null });

    const middleware = (await import("../system-only")).default;
    const result = await middleware({ fullPath: "/system/users" } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/auth/login?redirect=%2Fsystem%2Fusers");
    expect(result).toBe("/auth/login?redirect=%2Fsystem%2Fusers");
  });

  it("permite acceso a usuario system activo", async () => {
    mockEnsureAuthContext.mockResolvedValue({
      user: { id: "system-user-1" },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: "system-user-1",
        role: "system",
        is_active: true,
      },
      error: null,
    });

    const middleware = (await import("../system-only")).default;
    const result = await middleware({ fullPath: "/system" } as never, {} as never);

    expect(result).toBeUndefined();
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it("redirige usuario autenticado no-system a home de su rol", async () => {
    mockEnsureAuthContext.mockResolvedValue({
      user: { id: "admin-user-1" },
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockEnsureContext.mockResolvedValue({
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
