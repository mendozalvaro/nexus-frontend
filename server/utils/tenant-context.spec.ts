import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireActorContext = vi.fn();

vi.mock("./actor-context", () => ({
  requireActorContext: mockRequireActorContext,
}));

describe("tenant context actor guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActorContext.mockResolvedValue({
      adminClient: {},
      userId: "user-1",
      profile: {
        id: "user-1",
        organization_id: "org-1",
        role: "admin",
        role_id: "role-1",
        full_name: "Admin User",
        email: "admin@nexus.com",
        avatar_url: null,
        phone: null,
        is_active: true,
      },
      role: "admin",
      actorType: "staff",
      hasSystemAccess: false,
      systemRole: null,
    });
  });

  it("permite contexto staff para actores staff", async () => {
    const { requireStaffTenantContext } = await import("./tenant-context");

    await expect(requireStaffTenantContext({} as never)).resolves.toMatchObject({
      userId: "user-1",
      organizationId: "org-1",
      role: "admin",
    });
  });

  it("rechaza contexto staff para actores client", async () => {
    mockRequireActorContext.mockResolvedValueOnce({
      adminClient: {},
      userId: "client-1",
      profile: {
        id: "client-1",
        organization_id: "org-1",
        role: "client",
        role_id: null,
        full_name: "Client User",
        email: "client@nexus.com",
        avatar_url: null,
        phone: null,
        is_active: true,
      },
      role: "client",
      actorType: "client",
      hasSystemAccess: false,
      systemRole: null,
    });

    const { requireStaffTenantContext } = await import("./tenant-context");

    await expect(requireStaffTenantContext({} as never)).rejects.toThrow(/staff/);
  });

  it("permite contexto client para actores client", async () => {
    mockRequireActorContext.mockResolvedValueOnce({
      adminClient: {},
      userId: "client-1",
      profile: {
        id: "client-1",
        organization_id: "org-1",
        role: "client",
        role_id: null,
        full_name: "Client User",
        email: "client@nexus.com",
        avatar_url: null,
        phone: null,
        is_active: true,
      },
      role: "client",
      actorType: "client",
      hasSystemAccess: false,
      systemRole: null,
    });

    const { requireClientTenantContext } = await import("./tenant-context");

    await expect(requireClientTenantContext({} as never)).resolves.toMatchObject({
      userId: "client-1",
      organizationId: "org-1",
      role: "client",
    });
  });
});
