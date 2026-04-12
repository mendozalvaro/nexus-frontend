import type { Ref } from "vue";

import type { User } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import type {
  AuditAction,
  AuditFilters,
  AuditLog,
  AuditLogContext,
  AuditStats,
  ManualAuditAction,
} from "@/types/forensic";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

const DEFAULT_LOG_LIMIT = 25;
const MAX_LOG_LIMIT = 200;
const TOP_RESULTS_LIMIT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const getUserMetadata = (user: User | null): Record<string, unknown> => {
  if (!user || !isRecord(user.user_metadata)) {
    return {};
  }

  return user.user_metadata;
};

const getMetadataOrganizationId = (user: User | null): string | null => {
  const value = getUserMetadata(user).organization_id;
  return typeof value === "string" && value.length > 0 ? value : null;
};

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    typeof value === "string"
      ? value
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  const escapedValue = stringValue.replace(/"/g, "\"\"");
  return /[",\n\r]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
};

const normalizeLimit = (limit?: number): number => {
  if (typeof limit !== "number" || Number.isNaN(limit) || limit <= 0) {
    return DEFAULT_LOG_LIMIT;
  }

  return Math.min(Math.floor(limit), MAX_LOG_LIMIT);
};

const normalizeOffset = (offset?: number): number => {
  if (typeof offset !== "number" || Number.isNaN(offset) || offset < 0) {
    return 0;
  }

  return Math.floor(offset);
};

const mapManualActionToAuditAction = (action: ManualAuditAction): AuditAction => {
  if (action === "CUSTOM") {
    return "INSERT";
  }

  return action;
};

const sortCountEntries = <T extends { count: number }>(entries: T[]): T[] => {
  return [...entries].sort((left, right) => right.count - left.count);
};

export const useForensic = () => {
  const supabase = useSupabaseClient<Database>();
  const session = useSupabaseSession();
  const { isFeatureEnabled, loadCapabilities } = useSubscription();

  const isLoading = useState<boolean>("forensic:is-loading", () => false) as Ref<boolean>;
  const error = useState<string | null>("forensic:error", () => null) as Ref<string | null>;

  const user = computed<User | null>(() => session.value?.user ?? null);

  const setError = (message: string | null) => {
    error.value = message;
  };

  const resolveOrganizationId = async (): Promise<string | null> => {
    const metadataOrganizationId = getMetadataOrganizationId(user.value);
    if (metadataOrganizationId) {
      return metadataOrganizationId;
    }

    if (!user.value) {
      return null;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.value.id)
      .maybeSingle<Pick<ProfileRow, "organization_id">>();

    if (profileError) {
      throw profileError;
    }

    return data?.organization_id ?? null;
  };

  const resolveUserRole = async (): Promise<Database["public"]["Enums"]["user_role"] | null> => {
    if (!user.value) {
      return null;
    }

    const { data, error: roleError } = await supabase.rpc("get_user_role");
    if (roleError) {
      throw roleError;
    }

    return data;
  };

  const ensureAuditAccess = async (requestedOrgId?: string): Promise<string | null> => {
    if (!user.value) {
      setError("Debes iniciar sesi\u00f3n para acceder a la auditor\u00eda.");
      return null;
    }

    const organizationId = await resolveOrganizationId();
    if (!organizationId) {
      setError("Tu usuario no tiene una organizaci\u00f3n asignada.");
      return null;
    }

    if (requestedOrgId && requestedOrgId !== organizationId) {
      setError("No tienes permisos para acceder a logs de otra organizaci\u00f3n.");
      return null;
    }

    const role = await resolveUserRole();
    if (role !== "admin") {
      setError("Solo los administradores pueden acceder a la auditor\u00eda forense.");
      return null;
    }

    await loadCapabilities(organizationId);
    if (!isFeatureEnabled("hasForensicExport")) {
      setError("Tu plan actual no incluye acceso forense.");
      return null;
    }

    return organizationId;
  };

  /**
   * Registra una acci\u00f3n manual en `audit_logs`.
   * Las acciones `CUSTOM` se persisten como `INSERT` y se identifican
   * mediante `context.event = "CUSTOM"`.
   *
   * @example
   * ```ts
   * const { logAction } = useForensic()
   * await logAction("transactions", "CUSTOM", "tx-123", {
   *   event: "REFUND_REVIEWED",
   *   metadata: { reason: "manual_check" }
   * }, "Revisi\u00f3n manual de reembolso")
   * ```
   */
  const logAction = async (
    table: string,
    action: ManualAuditAction,
    recordId: string | null,
    context: AuditLogContext = {},
    customMessage?: string,
  ): Promise<boolean> => {
    isLoading.value = true;
    setError(null);

    try {
      if (!user.value) {
        setError("Debes iniciar sesi\u00f3n para registrar auditor\u00eda.");
        return false;
      }

      const organizationId = await resolveOrganizationId();
      if (!organizationId) {
        setError("No se pudo determinar la organizaci\u00f3n del usuario.");
        return false;
      }

      const payload: AuditLogInsert = {
        action: mapManualActionToAuditAction(action),
        table_name: table,
        record_id: recordId,
        user_id: user.value.id,
        context: {
          ...context,
          event: context.event ?? action,
          organization_id: organizationId,
          custom_message: customMessage ?? context.custom_message,
        } as Json,
      };

      const { error: insertError } = await supabase.from("audit_logs").insert(payload);
      if (insertError) {
        throw insertError;
      }

      return true;
    } catch (logError) {
      const message =
        logError instanceof Error
          ? logError.message
          : "No se pudo registrar la acci\u00f3n forense.";
      setError(message);
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Obtiene logs de auditor\u00eda con filtros, paginaci\u00f3n y conteo total.
   *
   * @example
   * ```ts
   * const { getAuditLogs } = useForensic()
   * const result = await getAuditLogs({ tableName: "transactions", limit: 20, offset: 0 })
   * console.log(result?.logs)
   * ```
   */
  const getAuditLogs = async (
    filters: AuditFilters = {},
  ): Promise<{ logs: AuditLog[]; total: number } | null> => {
    isLoading.value = true;
    setError(null);

    try {
      const organizationId = await ensureAuditAccess(filters.organizationId);
      if (!organizationId) {
        return null;
      }

      const limit = normalizeLimit(filters.limit);
      const offset = normalizeOffset(filters.offset);

      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .contains("context", { organization_id: organizationId })
        .order("logged_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.tableName) {
        query = query.eq("table_name", filters.tableName);
      }

      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      }

      if (filters.action) {
        query = query.eq("action", filters.action);
      }

      if (filters.startDate) {
        query = query.gte("logged_at", filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte("logged_at", filters.endDate.toISOString());
      }

      const { data, error: queryError, count } = await query;
      if (queryError) {
        throw queryError;
      }

      return {
        logs: data ?? [],
        total: count ?? 0,
      };
    } catch (queryError) {
      const message =
        queryError instanceof Error
          ? queryError.message
          : "No se pudieron obtener los logs de auditor\u00eda.";
      setError(message);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Exporta logs filtrados como CSV v\u00e1lido para descarga.
   *
   * @example
   * ```ts
   * const { exportAuditLogs } = useForensic()
   * const csvBlob = await exportAuditLogs({ startDate: new Date("2026-04-01") })
   * ```
   */
  const exportAuditLogs = async (filters: AuditFilters = {}): Promise<Blob | null> => {
    isLoading.value = true;
    setError(null);

    try {
      const organizationId = await ensureAuditAccess(filters.organizationId);
      if (!organizationId) {
        return null;
      }

      let query = supabase
        .from("audit_logs")
        .select("*")
        .contains("context", { organization_id: organizationId })
        .order("logged_at", { ascending: false });

      if (filters.tableName) {
        query = query.eq("table_name", filters.tableName);
      }

      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      }

      if (filters.action) {
        query = query.eq("action", filters.action);
      }

      if (filters.startDate) {
        query = query.gte("logged_at", filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte("logged_at", filters.endDate.toISOString());
      }

      const { data, error: exportError } = await query;
      if (exportError) {
        throw exportError;
      }

      const logs = data ?? [];
      const headers = [
        "id",
        "action",
        "table_name",
        "record_id",
        "user_id",
        "logged_at",
        "context",
        "old_data",
        "new_data",
        "checksum",
        "user_agent",
      ];

      const rows = logs.map((log) =>
        [
          log.id,
          log.action,
          log.table_name,
          log.record_id,
          log.user_id,
          log.logged_at,
          log.context,
          log.old_data,
          log.new_data,
          log.checksum,
          log.user_agent,
        ]
          .map((value) => escapeCsvValue(value))
          .join(","),
      );

      const csvContent = [headers.join(","), ...rows].join("\n");
      return new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "No se pudieron exportar los logs de auditor\u00eda.";
      setError(message);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Calcula m\u00e9tricas agregadas de auditor\u00eda para la organizaci\u00f3n actual.
   *
   * @example
   * ```ts
   * const { getAuditStats } = useForensic()
   * const stats = await getAuditStats(undefined, 30)
   * console.log(stats?.actionsByType)
   * ```
   */
  const getAuditStats = async (
    orgId?: string,
    days = 30,
  ): Promise<AuditStats | null> => {
    isLoading.value = true;
    setError(null);

    try {
      const organizationId = await ensureAuditAccess(orgId);
      if (!organizationId) {
        return null;
      }

      const safeDays = typeof days === "number" && Number.isFinite(days) && days > 0 ? days : 30;
      const startDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

      const { data, error: statsError } = await supabase
        .from("audit_logs")
        .select("action, user_id, table_name, logged_at")
        .contains("context", { organization_id: organizationId })
        .gte("logged_at", startDate);

      if (statsError) {
        throw statsError;
      }

      const logs = data ?? [];
      const actionsByType: Record<string, number> = {};
      const userCounts = new Map<string, number>();
      const tableCounts = new Map<string, number>();

      for (const log of logs) {
        actionsByType[log.action] = (actionsByType[log.action] ?? 0) + 1;

        const userId = log.user_id ?? "unknown";
        userCounts.set(userId, (userCounts.get(userId) ?? 0) + 1);

        tableCounts.set(log.table_name, (tableCounts.get(log.table_name) ?? 0) + 1);
      }

      return {
        totalActions: logs.length,
        actionsByType,
        topUsers: sortCountEntries(
          Array.from(userCounts.entries()).map(([user_id, count]) => ({ user_id, count })),
        ).slice(0, TOP_RESULTS_LIMIT),
        topTables: sortCountEntries(
          Array.from(tableCounts.entries()).map(([table_name, count]) => ({
            table_name,
            count,
          })),
        ).slice(0, TOP_RESULTS_LIMIT),
      };
    } catch (statsError) {
      const message =
        statsError instanceof Error
          ? statsError.message
          : "No se pudieron calcular las estad\u00edsticas de auditor\u00eda.";
      setError(message);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    logAction,
    getAuditLogs,
    exportAuditLogs,
    getAuditStats,
  };
};
