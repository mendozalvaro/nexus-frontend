import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const mockResolveAccessToken = vi.fn();

mockNuxtImport("useSessionAccess", () => () => ({
  resolveAccessToken: mockResolveAccessToken,
}));

mockNuxtImport("useUserContext", () => () => ({
  profile: ref({
    id: "user-1",
    organization_id: "org-1",
  }),
  accountStatus: ref("active"),
  paymentRequired: ref(false),
  setAccountStatusState: vi.fn(),
}));

describe("useAccountStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    globalStateMap.clear();
    mockResolveAccessToken.mockResolvedValue("token-1");
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("network error")));
  });

  it("no promociona a active cuando falla la carga sin cache previa", async () => {
    const { useAccountStatus } = await import("../useAccountStatus");
    const { loadAccountStatus } = useAccountStatus();

    const result = await loadAccountStatus({
      organizationId: "org-1",
      force: true,
    });

    expect(result.accountStatus).toBe("pending");
    expect(result.paymentRequired).toBe(false);
  });

  it("mantiene activo un trial vigente", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({
      snapshot: {
        organizationStatus: "active",
        subscriptionStatus: "trial",
        isTrial: true,
        trialEndsAt: "2099-01-01T00:00:00.000Z",
        latestValidationStatus: null,
      },
    }));

    const { useAccountStatus } = await import("../useAccountStatus");
    const { loadAccountStatus } = useAccountStatus();

    const result = await loadAccountStatus({
      organizationId: "org-1",
      force: true,
    });

    expect(result.accountStatus).toBe("active");
    expect(result.paymentRequired).toBe(false);
  });

  it("marca pago requerido para una suscripcion no trial en past_due", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({
      snapshot: {
        organizationStatus: "pending",
        subscriptionStatus: "past_due",
        isTrial: false,
        trialEndsAt: null,
        latestValidationStatus: null,
      },
    }));

    const { useAccountStatus } = await import("../useAccountStatus");
    const { loadAccountStatus } = useAccountStatus();

    const result = await loadAccountStatus({
      organizationId: "org-1",
      force: true,
    });

    expect(result.accountStatus).toBe("pending");
    expect(result.paymentRequired).toBe(true);
  });
});
