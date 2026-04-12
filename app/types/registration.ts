import type { User } from "@supabase/supabase-js";

import type { Json, Tables } from "@/types/database.types";

export interface RegistrationDraft {
  email: string;
  password: string;
  fullName: string;
  country: string;
  phone: string;
  acceptTerms: boolean;
}

export interface BillingData {
  businessName: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
}

export interface OrganizationDraft {
  organizationName: string;
  slug: string;
  timezone: string;
  currency: string;
  address: string;
  billingData: BillingData;
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

export interface SlugValidationResult {
  available: boolean;
  normalizedSlug: string;
  suggestions: string[];
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
