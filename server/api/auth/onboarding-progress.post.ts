import { z } from "zod";

import type { Database, Json } from "@/types/database.types";

import { throwApiError } from "../../utils/http-error";
import { requireAuthServerContext } from "../../utils/auth-server";

const onboardingProgressSchema = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  currentStep: z.string().trim().min(1),
  progressData: z.record(z.string(), z.unknown()).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const { adminClient, userId } = await requireAuthServerContext(event);
  const body = await readBody(event);
  const parsed = onboardingProgressSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "AUTH_ONBOARDING_PROGRESS_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload inválido para onboarding progress.",
      parsed.error.flatten(),
    );
  }

  if (!parsed.success) {
    throwApiError(
      400,
      "AUTH_ONBOARDING_PROGRESS_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para onboarding progress.",
      parsed.error.flatten(),
    );
    return;
  }
  const payload = parsed.data;
  const upsertPayload: Database["public"]["Tables"]["onboarding_progress"]["Insert"] = {
    user_id: userId,
    organization_id: payload.organizationId ?? null,
    current_step: payload.currentStep,
    progress_data: (payload.progressData ?? {}) as Json,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await adminClient
    .from("onboarding_progress")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    throwApiError(
      500,
      "AUTH_ONBOARDING_PROGRESS_SAVE_ERROR",
      error.message,
      { userId },
    );
  }

  return {
    progress: data,
  };
});
