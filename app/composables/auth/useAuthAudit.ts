import type { Ref } from "vue";

import type { AuthAuditContext } from "@/types/auth";
import type { Database } from "@/types/database.types";

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
    try {
      await $fetch("/api/auth/audit", {
        method: "POST",
        body: {
          action,
          tableName,
          context,
          recordId: options.recordId ?? userRef.value?.id ?? null,
          oldData: options.oldData ?? null,
          newData: options.newData ?? null,
        },
      });
    } catch (auditError) {
      const auditMessage =
        auditError instanceof Error ? auditError.message : "Unknown audit error";
      console.error("[AUTH_AUDIT_ERROR]", auditMessage);
    }
  };

  return {
    auditCriticalAction,
  };
};
