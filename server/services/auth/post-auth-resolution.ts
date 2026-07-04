import type { AuthAudience } from "@/types/auth";
import type { PostAuthResolution } from "@/types/registration";
import { sanitizeInternalRedirect } from "@/utils/redirect";
import { sanitizeStorefrontSlug } from "@/utils/auth";
import type { ServerActorContext } from "../../utils/actor-context";
import { getPostAuthContext } from "./post-auth-context";

const resolvePendingOrganizationDestination = (
  role: string | null,
  latestPaymentValidationStatus: string | null,
): PostAuthResolution => {
  if (role === "admin" && (!latestPaymentValidationStatus || latestPaymentValidationStatus === "rejected")) {
    return { destination: "/onboarding/payment", reason: "payment" };
  }

  return { destination: "/dashboard", reason: "pending" };
};

const resolveStaffOrClientDestination = (
  organizationId: string | null,
  role: string | null,
  organizationStatus: string | null,
  latestPaymentValidationStatus: string | null,
): PostAuthResolution => {
  if (!organizationId) return { destination: "/onboarding/organization", reason: "organization" };
  if (role === "client") return { destination: "/client/dashboard", reason: "active" };
  if (organizationStatus === "pending") {
    return resolvePendingOrganizationDestination(role, latestPaymentValidationStatus);
  }

  return { destination: "/dashboard", reason: "active" };
};

const buildUnauthorizedResolution = (
  destination: string,
  errorMessage: string,
): PostAuthResolution => ({
  destination,
  reason: "unauthorized",
  errorMessage,
});

const buildStorefrontDestination = (
  redirect?: string | null,
  slug?: string | null,
) => {
  const sanitizedRedirect = sanitizeInternalRedirect(redirect);
  if (sanitizedRedirect) {
    return sanitizedRedirect;
  }

  const sanitizedSlug = sanitizeStorefrontSlug(slug);
  return sanitizedSlug ? `/${sanitizedSlug}` : "/client/dashboard";
};

export const getPostAuthResolution = async (
  actor: ServerActorContext,
  options: {
    audience: AuthAudience | null;
    redirect: string | null;
    storefrontSlug: string | null;
  },
): Promise<PostAuthResolution> => {
  const postAuthContext = await getPostAuthContext(actor, {
    audience: options.audience,
    storefrontSlug: options.storefrontSlug,
  });

  if (options.audience === "client") {
    const storefrontDestination = buildStorefrontDestination(options.redirect, options.storefrontSlug);

    if (actor.actorType === "system" || actor.actorType === "staff") {
      return buildUnauthorizedResolution(
        storefrontDestination,
        "Esta cuenta no tiene acceso como cliente a esta tienda.",
      );
    }

    if (postAuthContext.storefrontClientStatus === "blocked") {
      return buildUnauthorizedResolution(
        storefrontDestination,
        "Tu acceso como cliente a esta tienda esta bloqueado.",
      );
    }

    if (postAuthContext.storefrontClientStatus === "inactive") {
      return buildUnauthorizedResolution(
        storefrontDestination,
        "Tu acceso como cliente a esta tienda esta inactivo.",
      );
    }

    if (actor.actorType === "client" || actor.role === "client") {
      return {
        destination: storefrontDestination,
        reason: "active",
      };
    }

    return buildUnauthorizedResolution(
      storefrontDestination,
      "No pudimos resolver acceso cliente para esta tienda.",
    );
  }

  if (postAuthContext.isSystem) {
    return { destination: "/system", reason: "active" };
  }

  if (
    options.audience === "staff"
    && (
      postAuthContext.resolvedRole === "client"
      || postAuthContext.hasClientAccount
    )
  ) {
    return buildUnauthorizedResolution(
      "/auth/login",
      "Esta cuenta no tiene acceso al panel interno.",
    );
  }

  const resolution = resolveStaffOrClientDestination(
    postAuthContext.organizationId,
    postAuthContext.resolvedRole,
    postAuthContext.organizationStatus,
    postAuthContext.latestPaymentValidationStatus,
  );

  const redirect = sanitizeInternalRedirect(options.redirect);
  if (options.audience === "staff" && redirect && resolution.reason === "active") {
    return {
      ...resolution,
      destination: redirect,
    };
  }

  return resolution;
};
