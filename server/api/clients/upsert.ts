import { serverSupabaseUser } from "#supabase/server";

import { throwApiError } from "../../utils/http-error";
import { upsertClientProfile } from "../../services/clientProfile";
import { clientUpsertSchema } from "@/types/client";

export default defineEventHandler(async (event) => {
  const authUser = await serverSupabaseUser(event);
  if (!authUser) {
    throwApiError(401, "CLIENT_UPSERT_UNAUTHORIZED", "No autorizado.");
    return;
  }

  const body = await readBody(event);
  const parsed = clientUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throwApiError(400, "CLIENT_UPSERT_INVALID_BODY", parsed.error.issues[0]?.message ?? "Payload invalido.");
    return;
  }

  const metadata = (authUser.user_metadata as Record<string, unknown> | undefined) ?? {};
  const metadataOrgId = typeof metadata.organization_id === "string" ? metadata.organization_id : null;

  const result = await upsertClientProfile(
    event,
    authUser.id,
    parsed.data,
    metadataOrgId,
  );

  return result;
});
