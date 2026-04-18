import type { Database } from "@/types/database.types";

export type SubscriptionStatus = Database["public"]["Enums"]["sub_status"] | "inactive";

export type SubscriptionPlanSlug = "emprende" | "crecimiento" | "enterprise";

export interface OrganizationCapabilities {
  planName: string;
  planSlug: SubscriptionPlanSlug;
  maxBranches: number;
  maxUsers: number;
  canCreateBranch: boolean;
  canCreateManager: boolean;
  canTransferStock: boolean;
  hasAdvancedReports: boolean;
  hasApiAccess: boolean;
  hasForensicExport: boolean;
  currentBranchesCount: number;
  currentUsersCount: number;
  subscriptionStatus: SubscriptionStatus;
  periodEnd: string | null;
  billingMode?: "monthly" | "quarterly" | "annual" | null;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  paymentMethod?: "tarjeta" | "efectivo" | "transferencia" | "qr" | null;
  paymentRequired?: boolean;
  planPermissions?: Record<string, boolean>;
  planLimits?: Record<string, number>;
  planFeatures?: string[];
}

export type SubscriptionResource = "branch" | "user";

export type CapabilityFeatureKey = keyof OrganizationCapabilities;
