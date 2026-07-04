import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const {
  mockNavigateTo,
  mockEnsureAuthContext,
  mockWarmupCurrentSession,
  mockEnsureRolePermissionsLoaded,
} = vi.hoisted(() => ({
  mockNavigateTo: vi.fn((target: string) => target),
  mockEnsureAuthContext: vi.fn(),
  mockWarmupCurrentSession: vi.fn(),
  mockEnsureRolePermissionsLoaded: vi.fn(),
}));

mockNuxtImport("navigateTo", () => mockNavigateTo);
mockNuxtImport("useAuth", () => () => ({
  resolvedRole: ref("guest"),
  auditCriticalAction: vi.fn(),
}));
mockNuxtImport("useAuthContext", () => () => ({
  ensureAuthContext: mockEnsureAuthContext,
}));
mockNuxtImport("useStartupWarmup", () => () => ({
  warmupCurrentSession: mockWarmupCurrentSession,
}));
mockNuxtImport("usePermissions", () => () => ({
  getAccessibleBranches: vi.fn().mockResolvedValue([]),
  resolveRouteAccess: vi.fn().mockResolvedValue({ allowed: true }),
  ensureRolePermissionsLoaded: mockEnsureRolePermissionsLoaded,
}));
mockNuxtImport("useBranchSelector", () => () => ({
  selectedBranchId: ref(null),
  restoreSelectedBranch: vi.fn(),
}));

describe("permissions middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();
  });

  it("redirige a login cuando no hay sesion", async () => {
    mockEnsureAuthContext.mockResolvedValue({
      user: null,
      profile: null,
      bootstrapState: "unauthenticated",
    });

    const middleware = (await import("../permissions")).default;
    const result = await middleware({
      fullPath: "/dashboard",
      path: "/dashboard",
      meta: {},
      params: {},
      query: {},
    } as never, {} as never);

    expect(mockNavigateTo).toHaveBeenCalledWith("/auth/login?redirect=%2Fdashboard");
    expect(result).toBe("/auth/login?redirect=%2Fdashboard");
  });
});
