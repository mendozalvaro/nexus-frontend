import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const mockResolveUser = vi.fn();
const mockFetchProfile = vi.fn();
const mockFetch = vi.fn();

vi.stubGlobal("$fetch", mockFetch);

mockNuxtImport("useSupabaseClient", () => () => ({
  auth: {
    signUp: vi.fn(),
    resend: vi.fn(),
    getUser: vi.fn(),
  },
}));

mockNuxtImport("useSupabaseSession", () => () => ref({
  user: { id: "system-user-1", email: "system@nexus.com", email_confirmed_at: "2026-05-09T12:00:00.000Z" },
}));

mockNuxtImport("useSessionAccess", () => () => ({
  resolveUser: mockResolveUser,
}));

mockNuxtImport("useAuth", () => () => ({
  fetchProfile: mockFetchProfile,
}));

describe("useRegistration.resolvePostAuthDestination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();

    mockResolveUser.mockResolvedValue({
      id: "system-user-1",
      email: "system@nexus.com",
      email_confirmed_at: "2026-05-09T12:00:00.000Z",
    });
  });

  it("prioriza /system sin intentar resolver onboarding para usuarios system", async () => {
    mockFetch.mockResolvedValue({
      isSystem: true,
      organizationStatus: null,
      latestPaymentValidationStatus: null,
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination()).resolves.toEqual({
      destination: "/system",
      reason: "active",
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/post-auth-context");
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it("mantiene onboarding para staff sin organizacion cuando no es system", async () => {
    mockFetch.mockResolvedValue({
      isSystem: false,
      organizationStatus: null,
      latestPaymentValidationStatus: null,
    });
    mockFetchProfile.mockResolvedValue({
      organization_id: null,
      role: "admin",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination()).resolves.toEqual({
      destination: "/onboarding/organization",
      reason: "organization",
    });
    expect(mockFetchProfile).toHaveBeenCalledTimes(1);
  });
});
