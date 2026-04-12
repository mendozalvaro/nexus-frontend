import type { Database, Json } from "@/types/database.types";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type AuditAction = Database["public"]["Enums"]["audit_action"];
export type ManualAuditAction = AuditAction | "CUSTOM";

export interface AuditFilters {
  tableName?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  organizationId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogContext {
  event?: string;
  organization_id?: string | null;
  custom_message?: string;
  metadata?: Json;
  [key: string]: Json | undefined;
}

export interface AuditStats {
  totalActions: number;
  actionsByType: Record<string, number>;
  topUsers: Array<{ user_id: string; count: number }>;
  topTables: Array<{ table_name: string; count: number }>;
}
