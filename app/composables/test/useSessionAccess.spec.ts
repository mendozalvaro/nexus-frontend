import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { globalStateMap } from "../../../test/setup";

const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

const mockSession = ref<{
  access_token?: string;
  user?: { id: string };
} | null>(null);
const mockSupabaseUser = ref<Record<string, unknown> | null>(null);

mockNuxtImport("useSupabaseClient", () => () => ({
  auth: {
    getSession: mockGetSession,
    getUser: mockGetUser,
  },
}));

mockNuxtImport("useSupabaseSession", () => () => mockSession);
mockNuxtImport("useSupabaseUser", () => () => mockSupabaseUser);

describe("useSessionAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();
    mockSession.value = null;
    mockSupabaseUser.value = null;
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  it("dedupes concurrent access token reads", async () => {
    mockGetSession.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        data: { session: { access_token: "token-123" } },
        error: null,
      };
    });

    const { useSessionAccess } = await import("../useSessionAccess");
    const { resolveAccessToken } = useSessionAccess();

    const [first, second] = await Promise.all([
      resolveAccessToken(),
      resolveAccessToken(),
    ]);

    expect(first).toBe("token-123");
    expect(second).toBe("token-123");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("reuses SSR Supabase user before access token hydration", async () => {
    mockSupabaseUser.value = {
      sub: "62f8861e-1234-4abc-9def-1234567890ab",
      email: "resprogreso@gmail.com",
      role: "authenticated",
      aud: "authenticated",
    };

    const { useSessionAccess } = await import("../useSessionAccess");
    const { resolveUser } = useSessionAccess();

    await expect(resolveUser()).resolves.toMatchObject({
      id: "62f8861e-1234-4abc-9def-1234567890ab",
      email: "resprogreso@gmail.com",
    });
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
