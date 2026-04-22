import { describe, expect, it } from "vitest";

import { assertValidDevAdminKey } from "../../../server/utils/dev-security";
import { resolveOrganizationIdForAppointmentProfile } from "../../../server/utils/appointments";

describe("security hardening", () => {
  it("rejects missing or invalid dev admin key", () => {
    expect(() => assertValidDevAdminKey(undefined, "expected-key")).toThrowError("Forbidden");
    expect(() => assertValidDevAdminKey("bad-key", "expected-key")).toThrowError("Forbidden");
  });

  it("accepts valid dev admin key", () => {
    expect(() => assertValidDevAdminKey("expected-key", "expected-key")).not.toThrow();
  });

  it("requires organization id for appointment context", () => {
    expect(() =>
      resolveOrganizationIdForAppointmentProfile({
        organization_id: null,
      }),
    ).toThrowError("No se pudo determinar la organizacion asociada para la agenda.");
  });

  it("resolves organization id for appointment context", () => {
    const organizationId = resolveOrganizationIdForAppointmentProfile({
      organization_id: "org-123",
    });

    expect(organizationId).toBe("org-123");
  });
});

