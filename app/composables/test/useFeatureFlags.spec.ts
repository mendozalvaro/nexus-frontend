import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";
import type { OrganizationCapabilities } from "@/types/subscription";

const capabilities = ref<OrganizationCapabilities | null>(null);

mockNuxtImport("useSubscription", () => () => ({
  capabilities,
  isLoading: ref(false),
}));

const createCapabilities = (
  overrides: Partial<OrganizationCapabilities> = {},
): OrganizationCapabilities => ({
  planName: "Emprende",
  planSlug: "emprende",
  maxBranches: 1,
  maxUsers: 3,
  canCreateBranch: false,
  canCreateManager: false,
  canTransferStock: false,
  hasAdvancedReports: false,
  hasApiAccess: false,
  hasForensicExport: false,
  hasHotelModule: false,
  businessTypes: ["lodging"],
  allowedBusinessTypes: ["product", "service", "lodging"],
  maxBusinessTypes: 1,
  currentBranchesCount: 1,
  currentUsersCount: 1,
  subscriptionStatus: "trial",
  periodEnd: null,
  planPermissions: {},
  planLimits: {},
  planFeatures: [],
  ...overrides,
});

describe("useFeatureFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    globalStateMap.clear();
    capabilities.value = null;
  });

  it("habilita hotel cuando el plan ya concede modulos lodging", async () => {
    capabilities.value = createCapabilities({
      hasHotelModule: false,
      planPermissions: {
        reservations: true,
        "catalog.rooms": true,
        "reports.lodging": true,
      },
    });

    const { useFeatureFlags } = await import("../useFeatureFlags");
    const { isFeatureEnabled } = useFeatureFlags();

    expect(isFeatureEnabled("feature_hotel_module")).toBe(true);
  });

  it("mantiene hotel apagado sin flag ni permisos lodging", async () => {
    capabilities.value = createCapabilities({
      hasHotelModule: false,
      planPermissions: {
        reservations: false,
        "catalog.rooms": false,
        "reports.lodging": false,
      },
    });

    const { useFeatureFlags } = await import("../useFeatureFlags");
    const { isFeatureEnabled } = useFeatureFlags();

    expect(isFeatureEnabled("feature_hotel_module")).toBe(false);
  });
});
