import { requireStaffTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const requestedOrganizationId = getQuery(event).organizationId;
  const organizationId =
    typeof requestedOrganizationId === "string" && requestedOrganizationId.length > 0
      ? requestedOrganizationId
      : context.organizationId;

  if (organizationId !== context.organizationId) {
    throw createError({
      statusCode: 403,
      statusMessage: "No puedes consultar el estado de otra organizacion.",
    });
  }

  const [
    { data: organization, error: organizationError },
    { data: subscription, error: subscriptionError },
    { data: paymentValidation, error: paymentValidationError },
  ] = await Promise.all([
    context.adminClient
      .from("organizations")
      .select("status")
      .eq("id", organizationId)
      .maybeSingle(),
    context.adminClient
      .from("organization_subscriptions")
      .select("status, is_trial, trial_ends_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    context.adminClient
      .from("payment_validations")
      .select("status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const error = organizationError ?? subscriptionError ?? paymentValidationError;
  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    snapshot: {
      organizationStatus: organization?.status ?? null,
      subscriptionStatus: subscription?.status ?? null,
      isTrial: subscription?.is_trial === true,
      trialEndsAt:
        typeof subscription?.trial_ends_at === "string" ? subscription.trial_ends_at : null,
      latestValidationStatus: paymentValidation?.status ?? null,
    },
  };
});
