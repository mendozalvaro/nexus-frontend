import { parseCookies } from "h3";
import { serverSupabaseUser } from "#supabase/server";
import { resolveServerAuthenticatedUser } from "../../utils/auth-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const runtimeSupabaseUrl =
    (config.public?.supabase as { url?: string } | undefined)?.url
    ?? process.env.NUXT_PUBLIC_SUPABASE_URL
    ?? null;
  const cookieMap = parseCookies(event);
  const authCookieNames = Object.keys(cookieMap).filter((name) => name.startsWith("nexuspos-auth"));
  const supabaseUser = await serverSupabaseUser(event);
  const resolvedAuthUser = await resolveServerAuthenticatedUser(event);

  const userId = (supabaseUser as { id?: unknown } | null)?.id;
  const userSub = (supabaseUser as { sub?: unknown } | null)?.sub;
  const userIdType = typeof userId;
  const userIdString = typeof userId === "string" ? userId : null;
  const userSubString = typeof userSub === "string" ? userSub : null;

  return {
    runtimeSupabaseUrl,
    hasAuthCookie: authCookieNames.length > 0,
    authCookieNames,
    resolvedUser: {
      exists: Boolean(supabaseUser),
      idType: userIdType,
      idPreview: userIdString ? `${userIdString.slice(0, 8)}...` : null,
      idIsUuid: userIdString ? UUID_REGEX.test(userIdString) : false,
      subType: typeof userSub,
      subPreview: userSubString ? `${userSubString.slice(0, 8)}...` : null,
      subIsUuid: userSubString ? UUID_REGEX.test(userSubString) : false,
      email: (supabaseUser as { email?: unknown } | null)?.email ?? null,
      role: (supabaseUser as { role?: unknown } | null)?.role ?? null,
      aud: (supabaseUser as { aud?: unknown } | null)?.aud ?? null,
    },
    resolvedAuthUser: {
      exists: Boolean(resolvedAuthUser),
      id: (resolvedAuthUser as { id?: unknown } | null)?.id ?? null,
      email: (resolvedAuthUser as { email?: unknown } | null)?.email ?? null,
    },
  };
});
