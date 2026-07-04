import type { AuthAudience } from "@/types/auth";
import type { PostAuthContextPayload } from "@/types/registration";
import { throwApiError } from "../../utils/http-error";
import type { ServerActorContext } from "../../utils/actor-context";

export const getPostAuthContext = async (
  actor: ServerActorContext,
  options: {
    audience: AuthAudience | null;
    storefrontSlug: string | null;
  },
): Promise<PostAuthContextPayload> => {
  const { adminClient, userId, profile } = actor;

  let organizationStatus: string | null = null;
  let latestPaymentValidationStatus: string | null = null;
  let resolvedStorefrontSlug: string | null = null;
  let storefrontClientStatus: "active" | "inactive" | "blocked" | null = null;
  let hasClientAccount = false;

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

  if (!profile) {
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (clientError) {
      throwApiError(
        500,
        "AUTH_POST_CONTEXT_CLIENT_LOOKUP_ERROR",
        clientError.message,
        { userId },
      );
    }

    hasClientAccount = Boolean(client?.id);
  }

  if (options.audience === "client" && options.storefrontSlug) {
    const { data: storefrontOrganization, error: storefrontOrganizationError } = await adminClient
      .from("organizations")
      .select("id, slug, status, is_active")
      .eq("slug", options.storefrontSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (storefrontOrganizationError) {
      throwApiError(
        500,
        "AUTH_POST_CONTEXT_STOREFRONT_ORG_ERROR",
        storefrontOrganizationError.message,
        { userId, slug: options.storefrontSlug },
      );
    }

    if (storefrontOrganization?.status === "active") {
      resolvedStorefrontSlug = storefrontOrganization.slug ?? options.storefrontSlug;

      const { data: client, error: clientError } = await adminClient
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (clientError) {
        throwApiError(
          500,
          "AUTH_POST_CONTEXT_CLIENT_ERROR",
          clientError.message,
          { userId, slug: options.storefrontSlug },
        );
      }

      if (client?.id) {
        const { data: clientOrg, error: clientOrgError } = await adminClient
          .from("client_org")
          .select("status")
          .eq("client_id", client.id)
          .eq("organization_id", storefrontOrganization.id)
          .maybeSingle();

        if (clientOrgError) {
          throwApiError(
            500,
            "AUTH_POST_CONTEXT_CLIENT_ORG_ERROR",
            clientOrgError.message,
            { userId, slug: options.storefrontSlug, organizationId: storefrontOrganization.id },
          );
        }

        storefrontClientStatus = (clientOrg?.status as "active" | "inactive" | "blocked" | null) ?? null;
      }
    }
  }

  return {
    isSystem: actor.hasSystemAccess,
    hasClientAccount,
    resolvedRole: actor.role,
    organizationId: profile?.organization_id ?? null,
    organizationStatus,
    latestPaymentValidationStatus,
    storefrontOrganizationSlug: resolvedStorefrontSlug,
    storefrontClientStatus,
  };
};
