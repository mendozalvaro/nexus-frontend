import type { Ref } from "vue";

import type { AuthAuditContext } from "@/types/auth";
import type { Database } from "@/types/database.types";

const AUTH_AUDIT_DEDUP_MS = 5_000;
const pendingAuthAudits = new Map<string, Promise<void>>();
const recentAuthAudits = new Map<string, number>();

const buildAuditKey = (
  action: Database["public"]["Enums"]["audit_action"],
  tableName: string,
  context: AuthAuditContext,
  recordId: string | null,
) => {
  return JSON.stringify({
    action,
    tableName,
    event: context.event,
    reason: context.reason ?? null,
    route: typeof context.route === "string" ? context.route : null,
    branch_id: typeof context.branch_id === "string" ? context.branch_id : null,
    organization_id: context.organization_id ?? null,
    role: context.role ?? null,
    recordId,
  });
};

export const useAuthAudit = (userRef: Ref<{ id: string } | null>) => {
  const auditCriticalAction = async (
    action: Database["public"]["Enums"]["audit_action"],
    tableName: string,
    context: AuthAuditContext,
    options: {
      recordId?: string | null;
      oldData?: Record<string, unknown> | null;
      newData?: Record<string, unknown> | null;
    } = {},
  ) => {
    const recordId = options.recordId ?? userRef.value?.id ?? null;
    const auditKey = buildAuditKey(action, tableName, context, recordId);
    const lastAuditAt = recentAuthAudits.get(auditKey) ?? 0;

    if (Date.now() - lastAuditAt < AUTH_AUDIT_DEDUP_MS) {
      return;
    }

    const pendingAudit = pendingAuthAudits.get(auditKey);
    if (pendingAudit) {
      return await pendingAudit;
    }

    const loader = (async () => {
      try {
        await $fetch("/api/auth/audit", {
          method: "POST",
          body: {
            action,
            tableName,
            context,
            recordId,
            oldData: options.oldData ?? null,
            newData: options.newData ?? null,
          },
        });
        recentAuthAudits.set(auditKey, Date.now());
      } catch (auditError) {
        const auditMessage =
          auditError instanceof Error ? auditError.message : "Unknown audit error";
        console.error("[AUTH_AUDIT_ERROR]", auditMessage);
      } finally {
        pendingAuthAudits.delete(auditKey);
      }
    })();

    pendingAuthAudits.set(auditKey, loader);

    try {
      await loader;
    } finally {
      for (const [key, timestamp] of recentAuthAudits.entries()) {
        if (Date.now() - timestamp >= AUTH_AUDIT_DEDUP_MS) {
          recentAuthAudits.delete(key);
        }
      }
    }
  };

  return {
    auditCriticalAction,
  };
};
