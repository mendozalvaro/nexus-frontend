import type { User } from "@supabase/supabase-js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const mockResolveUser = vi.fn();
const mockResolveAccessToken = vi.fn();
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
  resolveAccessToken: mockResolveAccessToken,
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
    mockResolveAccessToken.mockResolvedValue("token-123");
  });

  it("prioriza /system sin intentar resolver onboarding para usuarios system", async () => {
    mockFetch.mockResolvedValue({
      destination: "/system",
      reason: "active",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination()).resolves.toEqual({
      destination: "/system",
      reason: "active",
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/post-auth-resolution", {
      headers: { Authorization: "Bearer token-123" },
      query: {
        audience: undefined,
        slug: undefined,
        redirect: undefined,
      },
    });
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it("mantiene onboarding para staff sin organizacion cuando no es system", async () => {
    mockFetch.mockResolvedValue({
      destination: "/onboarding/organization",
      reason: "organization",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination()).resolves.toEqual({
      destination: "/onboarding/organization",
      reason: "organization",
    });
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it("bloquea acceso staff cuando el callback viene con audiencia client", async () => {
    mockFetch.mockResolvedValue({
      destination: "/demo-shop",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso como cliente a esta tienda.",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination({
      audience: "client",
      redirect: "/demo-shop",
      slug: "demo-shop",
    })).resolves.toEqual({
      destination: "/demo-shop",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso como cliente a esta tienda.",
    });
  });

  it("redirige cliente a storefront cuando el callback viene con audiencia client", async () => {
    mockFetch.mockResolvedValue({
      destination: "/demo-shop",
      reason: "active",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination({
      audience: "client",
      redirect: "/demo-shop",
      slug: "demo-shop",
    })).resolves.toEqual({
      destination: "/demo-shop",
      reason: "active",
    });
  });

  it("bloquea acceso staff para cuentas client aunque el actor inicial llegue sin perfil", async () => {
    mockFetch.mockResolvedValue({
      destination: "/auth/login",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso al panel interno.",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination({
      audience: "staff",
    })).resolves.toEqual({
      destination: "/auth/login",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso al panel interno.",
    });
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it("bloquea acceso staff cuando server detecta cuenta client sin profile local", async () => {
    mockFetch.mockResolvedValue({
      destination: "/auth/login",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso al panel interno.",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    await expect(resolvePostAuthDestination({
      audience: "staff",
    })).resolves.toEqual({
      destination: "/auth/login",
      reason: "unauthorized",
      errorMessage: "Esta cuenta no tiene acceso al panel interno.",
    });
  });

  it("reutiliza el usuario ya resuelto cuando el caller lo provee", async () => {
    mockFetch.mockResolvedValue({
      destination: "/dashboard",
      reason: "active",
    });

    const { useRegistration } = await import("../useRegistration");
    const { resolvePostAuthDestination } = useRegistration();

    const user: User = {
      id: "system-user-1",
      email: "system@nexus.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-05-09T12:00:00.000Z",
      email_confirmed_at: "2026-05-09T12:00:00.000Z",
    };

    await expect(resolvePostAuthDestination({ user })).resolves.toEqual({
      destination: "/dashboard",
      reason: "active",
    });
    expect(mockResolveUser).not.toHaveBeenCalled();
  });
});
