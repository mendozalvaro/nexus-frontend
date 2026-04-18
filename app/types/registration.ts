import type { User } from "@supabase/supabase-js";

import type { Json, Tables } from "@/types/database.types";
import type { SubscriptionPlanSlug } from "./subscription";

export type BillingMode = "monthly" | "quarterly" | "annual";
export type BusinessType = "products" | "services" | "hybrid";

export interface RegistrationDraft {
  fullName: string;
  email: string;
  password: string;
  acceptTerms: boolean;
  selectedPlan: SubscriptionPlanSlug;
  billingMode: BillingMode;
}

export interface OrganizationDraft {
  organizationName: string;
  businessType: BusinessType;
  selectedPlan: SubscriptionPlanSlug;
  billingMode: BillingMode;
  country: string;
  currency: string;
  timezone: string;
  logoPreviewUrl: string | null;
  logoFileName: string | null;
}

export interface OnboardingProgressRow extends Tables<"onboarding_progress"> {}

export interface OnboardingProgressPayload {
  currentStep: OnboardingStep;
  progressData: Json;
  organizationId?: string | null;
}

export interface RegistrationResult {
  user: User | null;
  requiresEmailVerification: boolean;
  email: string;
}

export interface PostAuthResolution {
  destination: string;
  reason:
    | "login"
    | "verify"
    | "organization"
    | "payment"
    | "pending"
    | "active";
}
