import { describe, expect, it } from "vitest";
import {
  assertNotificationAdminAccess,
  assertNotificationHistoryAccess,
  assertNotificationSendAccess,
  buildPreferencesPatchPayload,
} from "./context";

describe("notifications context guards", () => {
  it("allows only admin for admin actions", () => {
    expect(() => assertNotificationAdminAccess("admin")).not.toThrow();
    expect(() => assertNotificationAdminAccess("manager")).toThrowError(/Admin access required/);
    expect(() => assertNotificationAdminAccess("employee")).toThrowError(/Admin access required/);
    expect(() => assertNotificationAdminAccess("client")).toThrowError(/Admin access required/);
  });

  it("allows admin and manager for history actions", () => {
    expect(() => assertNotificationHistoryAccess("admin")).not.toThrow();
    expect(() => assertNotificationHistoryAccess("manager")).not.toThrow();
    expect(() => assertNotificationHistoryAccess("employee")).toThrowError(/Insufficient permissions/);
    expect(() => assertNotificationHistoryAccess("client")).toThrowError(/Insufficient permissions/);
  });

  it("allows admin, manager and employee for send actions", () => {
    expect(() => assertNotificationSendAccess("admin")).not.toThrow();
    expect(() => assertNotificationSendAccess("manager")).not.toThrow();
    expect(() => assertNotificationSendAccess("employee")).not.toThrow();
    expect(() => assertNotificationSendAccess("client")).toThrowError(/Insufficient permissions/);
  });
});

describe("buildPreferencesPatchPayload", () => {
  it("preserves token when empty string is sent", () => {
    const payload = buildPreferencesPatchPayload({
      whatsapp_enabled: true,
      whatsapp_access_token: "",
    });

    expect(payload.whatsapp_enabled).toBe(true);
    expect("whatsapp_access_token" in payload).toBe(false);
    expect(typeof payload.updated_at).toBe("string");
  });

  it("allows explicit token update", () => {
    const payload = buildPreferencesPatchPayload({
      whatsapp_access_token: "new-secret",
    });

    expect(payload.whatsapp_access_token).toBe("new-secret");
    expect(typeof payload.updated_at).toBe("string");
  });
});

