import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireAuthServerContext } from "../../utils/auth-server";
import { createOnboardingOrganizationForUser } from "../../services/onboarding";

const organizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  businessTypes: z.array(z.string()).min(1),
  planSlug: z.enum(["emprende", "crecimiento", "enterprise"]),
  country: z.string().trim().min(2),
  currency: z.string().trim().length(3),
  timezone: z.string().trim().min(1),
  billingMode: z.enum(["monthly", "quarterly", "annual"]),
  activationMode: z.enum(["trial", "paid"]),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().nullable().optional(),
  logo: z.object({
    dataBase64: z.string(),
    name: z.string(),
    type: z.string(),
  }).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthServerContext(event);
  const body = await readBody(event);
  const parsed = organizationSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "ONBOARDING_ORGANIZATION_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido.",
      parsed.error.flatten(),
    );
    return;
  }

  const result = await createOnboardingOrganizationForUser(event, userId, parsed.data);

  return {
    organizationId: result.organizationId,
    nextStep: result.nextStep,
  };
});
