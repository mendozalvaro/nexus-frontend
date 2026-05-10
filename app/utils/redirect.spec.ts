import { describe, expect, it } from "vitest";

import { buildLoginRedirectPath, sanitizeInternalRedirect } from "./redirect";

describe("redirect utils", () => {
  it("acepta rutas internas validas", () => {
    expect(sanitizeInternalRedirect("/inventory")).toBe("/inventory");
    expect(sanitizeInternalRedirect("/client/dashboard?tab=next")).toBe("/client/dashboard?tab=next");
  });

  it("rechaza rutas externas o inseguras", () => {
    expect(sanitizeInternalRedirect("https://example.com")).toBeNull();
    expect(sanitizeInternalRedirect("//example.com")).toBeNull();
    expect(sanitizeInternalRedirect("inventory")).toBeNull();
    expect(sanitizeInternalRedirect("")).toBeNull();
  });

  it("construye el login redirect preservando el destino", () => {
    expect(buildLoginRedirectPath("/inventory")).toBe("/auth/login?redirect=%2Finventory");
    expect(buildLoginRedirectPath("https://example.com")).toBe("/auth/login");
  });
});
