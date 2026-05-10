import { throwApiError } from "../../utils/http-error";
import { requireAuthServerContext } from "../../utils/auth-server";

export default defineEventHandler(async (event) => {
  const { adminClient, userId } = await requireAuthServerContext(event);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throwApiError(
      500,
      "AUTH_POST_CONTEXT_PROFILE_ERROR",
      profileError.message,
      { userId },
    );
  }

  const { data: isSystem, error: systemError } = await adminClient.rpc("is_system_user", {
    input_user_id: userId,
  });
  if (systemError) {
    throwApiError(
      500,
      "AUTH_POST_CONTEXT_SYSTEM_ERROR",
      systemError.message,
      { userId },
    );
  }

  let organizationStatus: string | null = null;
  let latestPaymentValidationStatus: string | null = null;

  if (profile?.organization_id) {
    const { data: organization, error: organizationError } = await adminClient
      .from("organizations")
      .select("status")
      .eq("id", profile.organization_id)
      .maybeSingle();

    if (organizationError) {
      throwApiError(
        500,
        "AUTH_POST_CONTEXT_ORG_ERROR",
        organizationError.message,
        { userId, organizationId: profile.organization_id },
      );
    }
    organizationStatus = organization?.status ?? null;

    const { data: validation, error: validationError } = await adminClient
      .from("payment_validations")
      .select("status")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (validationError) {
      throwApiError(
        500,
        "AUTH_POST_CONTEXT_PAYMENT_VALIDATION_ERROR",
        validationError.message,
        { userId, organizationId: profile.organization_id },
      );
    }
    latestPaymentValidationStatus = validation?.status ?? null;
  }

  return {
    isSystem: Boolean(isSystem),
    profile: profile ?? null,
    organizationStatus,
    latestPaymentValidationStatus,
  };
});
