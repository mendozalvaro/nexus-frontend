import { z } from "zod";
import { serverSupabaseUser } from "#supabase/server";

import type { Database } from "@/types/database.types";
import { createAdminServerClient } from "../../utils/auth-server";
import { throwApiError } from "../../utils/http-error";

const authAuditSchema = z.object({
  action: z.enum(["INSERT", "UPDATE", "DELETE", "PERMISSION_DENIED"]),
  tableName: z.string().trim().min(1),
  context: z.object({
    event: z.enum([
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "SIGN_UP",
      "SIGN_OUT",
      "PROFILE_UPDATED",
      "PERMISSION_DENIED",
    ]),
    email: z.string().optional(),
    organization_id: z.string().uuid().nullable().optional(),
    role: z.enum(["admin", "manager", "employee", "client"]).nullable().optional(),
    reason: z.string().optional(),
    metadata: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown()), z.string(), z.number(), z.boolean(), z.null()]).optional(),
  }).passthrough(),
  recordId: z.string().uuid().nullable().optional(),
  oldData: z.record(z.string(), z.unknown()).nullable().optional(),
  newData: z.record(z.string(), z.unknown()).nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = authAuditSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "AUTH_AUDIT_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para auditoria auth.",
      parsed.error.flatten(),
    );
    return;
  }

  const payload = parsed.data;
  const isLoginFailedEvent = payload.context.event === "LOGIN_FAILED";

  const user = await serverSupabaseUser(event);
  if (!user && !isLoginFailedEvent) {
    throwApiError(401, "AUTH_AUDIT_UNAUTHORIZED", "No autorizado para registrar auditoria.");
  }

  const adminClient = createAdminServerClient(event);
  const userId = user?.id ?? null;

  const insertPayload: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
    action: payload.action,
    table_name: payload.tableName,
    record_id: payload.recordId ?? userId,
    user_id: userId,
    old_data: (payload.oldData ?? null) as Database["public"]["Tables"]["audit_logs"]["Insert"]["old_data"],
    new_data: (payload.newData ?? null) as Database["public"]["Tables"]["audit_logs"]["Insert"]["new_data"],
    context: payload.context as Database["public"]["Tables"]["audit_logs"]["Insert"]["context"],
  };

  const { error } = await adminClient.from("audit_logs").insert(insertPayload);
  if (error) {
    throwApiError(500, "AUTH_AUDIT_SAVE_ERROR", error.message);
  }

  return { ok: true };
});
