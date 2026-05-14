import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireAuthServerContext } from "../../utils/auth-server";
import { createOnboardingOrganization } from "../../services/onboarding";

const organizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  businessType: z.enum(["products", "services", "hybrid"]),
  country: z.string().trim().min(2),
  currency: z.string().trim().length(3),
  timezone: z.string().trim().min(1),
  billingMode: z.enum(["monthly", "quarterly", "annual"]),
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
  const { adminClient, userId } = await requireAuthServerContext(event);
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

  const input = parsed.data;

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throwApiError(500, "PROFILE_FETCH_ERROR", profileError.message);
  }

  if (profile?.organization_id) {
    return { organizationId: profile.organization_id };
  }

  let logoFile: { data: Buffer; name: string; type: string } | null = null;
  if (input.logo?.dataBase64) {
    const base64Data = input.logo.dataBase64.split(",")[1] ?? input.logo.dataBase64;
    logoFile = {
      data: Buffer.from(base64Data, "base64"),
      name: input.logo.name,
      type: input.logo.type,
    };
  }

  const result = await createOnboardingOrganization(event, userId, {
    organizationName: input.organizationName,
    businessType: input.businessType,
    country: input.country,
    currency: input.currency,
    timezone: input.timezone,
    billingMode: input.billingMode,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
  }, logoFile);

  return { organizationId: result.organizationId };
});
