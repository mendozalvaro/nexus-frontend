import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { globalStateMap } from "../../../test/setup";

const profile = ref({
  id: "user-1",
  role: "admin",
  role_id: "role-1",
  organization_id: "org-1",
});

mockNuxtImport("useSupabaseClient", () => () => ({}));
mockNuxtImport("useUserContext", () => () => ({
  user: ref({ id: "user-1" }),
  profile,
  permissionsRevision: ref(0),
  setPermissionGrants: vi.fn(),
}));
mockNuxtImport("useActorContext", () => () => ({
  baseActorType: ref("staff"),
  hasSystemAccess: ref(false),
}));
mockNuxtImport("useSessionAccess", () => () => ({
  resolveAccessToken: vi.fn(),
}));
mockNuxtImport("useFeatureFlags", () => () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));
mockNuxtImport("useSubscription", () => () => ({
  capabilities: ref(null),
}));
mockNuxtImport("useBusinessTypes", () => () => ({
  hasBusinessType: vi.fn().mockReturnValue(true),
}));

describe("usePermissions.getUserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    globalStateMap.clear();
    profile.value = {
      id: "user-1",
      role: "admin",
      role_id: "role-1",
      organization_id: "org-1",
    };
  });

  it("usa fallback por rol cuando no existe role_id utilizable", async () => {
    profile.value = {
      ...profile.value,
      role_id: undefined as unknown as string,
    };

    const { usePermissions } = await import("../usePermissions");
    const { getUserPermissions, hasPermission } = usePermissions();

    const permissions = getUserPermissions();

    expect(permissions.length).toBeGreaterThan(0);
    expect(hasPermission(permissions, "dashboard.view")).toBe(true);
    expect(hasPermission(permissions, "users.create")).toBe(true);
  });

  it("no abre permisos staff cuando falla la carga remota sin cache previa", async () => {
    globalStateMap.set("permissions:db-grants", ref([]));
    globalStateMap.set("permissions:db-role-id", ref("role-1"));
    globalStateMap.set("permissions:db-state", ref("error"));

    const { usePermissions } = await import("../usePermissions");
    const { getUserPermissions, hasPermission } = usePermissions();

    const permissions = getUserPermissions();

    expect(permissions).toEqual([]);
    expect(hasPermission(permissions, "dashboard.view")).toBe(false);
  });
});
