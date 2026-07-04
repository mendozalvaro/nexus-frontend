import type { User } from "@supabase/supabase-js";

import type { AuthAudience } from "@/types/auth";
import type { PostAuthResolution } from "@/types/registration";
import { sanitizeAuthAudience, sanitizeStorefrontSlug } from "@/utils/auth";
import { sanitizeInternalRedirect } from "@/utils/redirect";

export const usePostAuthResolution = () => {
  const { resolveAccessToken, resolveUser } = useSessionAccess();

  const resolvePostAuthDestination = async (
    options: {
      audience?: AuthAudience | null;
      redirect?: string | null;
      slug?: string | null;
      user?: User | null;
    } = {},
  ): Promise<PostAuthResolution> => {
    const user = options.user ?? await resolveUser();
    if (!user) return { destination: "/auth/login", reason: "login" };
    if (!user.email_confirmed_at) {
      return {
        destination: `/auth/verify-email?email=${encodeURIComponent(user.email ?? "")}`,
        reason: "verify",
      };
    }

    const accessToken = await resolveAccessToken();
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    const audience = sanitizeAuthAudience(options.audience);
    const slug = sanitizeStorefrontSlug(options.slug);
    const redirect = sanitizeInternalRedirect(options.redirect);

    try {
      return await $fetch<PostAuthResolution>("/api/auth/post-auth-resolution", {
        ...(headers ? { headers } : {}),
        query: {
          audience: audience ?? undefined,
          slug: slug ?? undefined,
          redirect: redirect ?? undefined,
        },
      });
    } catch {
      return { destination: "/auth/login", reason: "login" };
    }
  };

  return {
    resolvePostAuthDestination,
  };
};
