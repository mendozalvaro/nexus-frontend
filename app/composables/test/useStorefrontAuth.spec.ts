import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const mockResolveAccessToken = vi.fn();
const mockSignIn = vi.fn();
const mockSignInWithProvider = vi.fn();

mockNuxtImport("useSessionAccess", () => () => ({
  resolveAccessToken: mockResolveAccessToken,
}));

mockNuxtImport("useAuth", () => () => ({
  signIn: mockSignIn,
  signInWithProvider: mockSignInWithProvider,
}));

describe("useStorefrontAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();

    mockResolveAccessToken.mockResolvedValue(null);
    mockSignIn.mockResolvedValue({
      data: { access_token: "token-123" },
      error: null,
    });
    mockSignInWithProvider.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("inicia oauth client preservando slug y redirect", async () => {
    const { useStorefrontAuth } = await import("../useStorefrontAuth");
    const { signInWithProvider } = useStorefrontAuth();

    await signInWithProvider("google", "demo-shop");

    expect(mockSignInWithProvider).toHaveBeenCalledWith("google", {
      audience: "client",
      redirect: "/demo-shop",
      slug: "demo-shop",
    });
  });
});
