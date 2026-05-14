import { z } from "zod";
import { serverSupabaseUser } from "#supabase/server";

import { throwApiError } from "../../utils/http-error";
import { getClientProfile } from "../../services/clientProfile";

const querySchema = z.object({
  organizationId: z.string().uuid("organizationId invalido."),
}).strict();

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event);
  if (!authUser) {
    return { profile: null };
  }

  const parsedQuery = querySchema.safeParse(getQuery(event));
  if (!parsedQuery.success) {
    throwApiError(400, "CLIENT_PROFILE_INVALID_QUERY", parsedQuery.error.issues[0]?.message ?? "Query invalida.");
    return;
  }

  const profile = await getClientProfile(event, authUser.id, parsedQuery.data!.organizationId);
  return { profile };
});
