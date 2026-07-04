import { describe, expect, it } from "vitest";

import { resolveOnboardingPaymentRedirect } from "./onboarding";

describe("onboarding utils", () => {
  it("mantiene la pantalla de pago cuando el pago sigue siendo requerido", () => {
    expect(resolveOnboardingPaymentRedirect({
      accountStatus: "pending",
      paymentRequired: true,
    })).toBeNull();
  });

  it("redirige al dashboard pendiente cuando la cuenta ya opera sin pago requerido", () => {
    expect(resolveOnboardingPaymentRedirect({
      accountStatus: "pending",
      paymentRequired: false,
    })).toBe("/dashboard");
  });

  it("redirige al dashboard activo cuando la cuenta ya esta operativa", () => {
    expect(resolveOnboardingPaymentRedirect({
      accountStatus: "active",
      paymentRequired: false,
    })).toBe("/dashboard");
  });

  it("mantiene la pantalla de pago cuando la validacion fue rechazada", () => {
    expect(resolveOnboardingPaymentRedirect({
      accountStatus: "rejected",
      paymentRequired: false,
    })).toBeNull();
  });
});
