import { getCookie } from "h3";
import { serverSupabaseUser } from "#supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const authCookie = getCookie(event, "nexuspos-auth");
  const supabaseUser = await serverSupabaseUser(event);

  const userId = (supabaseUser as { id?: unknown } | null)?.id;
  const userSub = (supabaseUser as { sub?: unknown } | null)?.sub;
  const userIdType = typeof userId;
  const userIdString = typeof userId === "string" ? userId : null;
  const userSubString = typeof userSub === "string" ? userSub : null;

  return {
    hasAuthCookie: Boolean(authCookie),
    authCookiePrefix: authCookie ? authCookie.slice(0, 32) : null,
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
  };
});
