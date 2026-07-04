import { getQuery } from "h3";

import { getPostAuthContext } from "../../services/auth/post-auth-context";
import { requireActorContext } from "../../utils/actor-context";
import { sanitizeAuthAudience, sanitizeStorefrontSlug } from "@/utils/auth";

export default defineEventHandler(async (event) => {
  const actor = await requireActorContext(event, { preferSystem: true });
  const query = getQuery(event);
  const audience = sanitizeAuthAudience(query.audience);
  const storefrontSlug = sanitizeStorefrontSlug(query.slug);
  return await getPostAuthContext(actor, {
    audience,
    storefrontSlug,
  });
});
