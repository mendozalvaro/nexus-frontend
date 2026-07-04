import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const mockEnsureContext = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

mockNuxtImport("useUserContext", () => () => ({
  user: ref(null),
  profile: ref(null),
  contextBootstrapState: ref("idle"),
  ensureContext: mockEnsureContext,
}));

mockNuxtImport("useSupabaseClient", () => () => ({
  from: mockFrom,
}));

describe("useActorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStateMap.clear();
  });

  it("resuelve actor system cuando se prefiere system y existe acceso", async () => {
    mockEnsureContext.mockResolvedValue({
      user: { id: "system-user-1" },
      profile: { role: "admin" },
    });
    mockMaybeSingle.mockResolvedValue({
      data: { user_id: "system-user-1", role: "system", is_active: true },
      error: null,
    });

    const { useActorContext } = await import("../useActorContext");
    const { resolveActorContext } = useActorContext();

    await expect(resolveActorContext({ preferSystem: true })).resolves.toMatchObject({
      actorType: "system",
      hasSystemAccess: true,
      systemRole: "system",
    });
  });

  it("resuelve actor client cuando el perfil es client", async () => {
    mockEnsureContext.mockResolvedValue({
      user: { id: "client-user-1" },
      profile: { role: "client" },
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { useActorContext } = await import("../useActorContext");
    const { resolveActorContext } = useActorContext();

    await expect(resolveActorContext({ requireProfile: true })).resolves.toMatchObject({
      actorType: "client",
      hasSystemAccess: false,
    });
  });
});
