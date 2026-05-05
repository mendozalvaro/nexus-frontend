import type { RegistrationDraft } from "@/types/registration";
import {
  ORGANIZATION_STORAGE_KEY,
  PAYMENT_STORAGE_KEY,
  REGISTRATION_STORAGE_KEY,
  RESEND_STORAGE_KEY,
} from "@/utils/onboarding";

const isClientRuntime = () => import.meta.client;

export const loadRegistrationDraft = (
  createDefaultDraft: () => RegistrationDraft,
): RegistrationDraft => {
  if (!isClientRuntime()) return createDefaultDraft();

  const rawValue = localStorage.getItem(REGISTRATION_STORAGE_KEY);
  if (!rawValue) return createDefaultDraft();

  try {
    const parsed = JSON.parse(rawValue) as RegistrationDraft;
    return { ...createDefaultDraft(), ...parsed };
  } catch {
    localStorage.removeItem(REGISTRATION_STORAGE_KEY);
    return createDefaultDraft();
  }
};

export const saveRegistrationDraft = (draft: RegistrationDraft) => {
  if (!isClientRuntime()) return;
  localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(draft));
};

export const loadResendState = <T extends { lastSentAt: number }>(
  createDefaultState: () => T,
): T => {
  if (!isClientRuntime()) return createDefaultState();

  const rawValue = localStorage.getItem(RESEND_STORAGE_KEY);
  if (!rawValue) return createDefaultState();

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    localStorage.removeItem(RESEND_STORAGE_KEY);
    return createDefaultState();
  }
};

export const saveResendState = (state: { lastSentAt: number }) => {
  if (!isClientRuntime()) return;
  localStorage.setItem(RESEND_STORAGE_KEY, JSON.stringify(state));
};

export const clearOnboardingDraftsStorage = () => {
  if (!isClientRuntime()) return;
  localStorage.removeItem(REGISTRATION_STORAGE_KEY);
  localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
  localStorage.removeItem(PAYMENT_STORAGE_KEY);
};
