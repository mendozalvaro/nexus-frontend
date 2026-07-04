import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

describe("useAuthAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T00:00:00.000Z"));
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("deduplica auditorias identicas en la ventana corta", async () => {
    const { useAuthAudit } = await import("./useAuthAudit");
    const { auditCriticalAction } = useAuthAudit(ref({ id: "user-1" }));

    await auditCriticalAction("PERMISSION_DENIED", "permissions", {
      event: "PERMISSION_DENIED",
      reason: "module",
      route: "/inventory",
    });

    await auditCriticalAction("PERMISSION_DENIED", "permissions", {
      event: "PERMISSION_DENIED",
      reason: "module",
      route: "/inventory",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
