import { getQuery } from "h3";

import { sanitizeAuthAudience, sanitizeStorefrontSlug } from "@/utils/auth";
import { sanitizeInternalRedirect } from "@/utils/redirect";
import { requireActorContext } from "../../utils/actor-context";
import { getPostAuthResolution } from "../../services/auth/post-auth-resolution";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const audience = sanitizeAuthAudience(query.audience);
  const storefrontSlug = sanitizeStorefrontSlug(query.slug);
  const redirect = typeof query.redirect === "string"
    ? sanitizeInternalRedirect(query.redirect)
    : null;

  const actor = await requireActorContext(event, {
    preferSystem: audience !== "client",
  });

  return await getPostAuthResolution(actor, {
    audience,
    redirect,
    storefrontSlug,
  });
});
