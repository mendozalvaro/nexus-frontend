import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

const billingDataSchema = z.object({
  invoice_name: z.string().trim().min(1).max(200).optional(),
  doc_type: z.enum(["nit", "ci", "pasaporte", "cedula"]).optional(),
  doc_number: z.string().trim().max(50).optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "BILLING_DATA_ADMIN_ONLY", "Solo administradores pueden actualizar datos de facturacion.");
  }

  const body = await readBody(event);
  const parsed = billingDataSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "BILLING_DATA_INVALID",
      parsed.error.issues[0]?.message ?? "Payload invalido.",
      parsed.error.flatten(),
    );
  }

  const updates = parsed.data!;

  if (Object.keys(updates).length === 0) {
    throwApiError(400, "BILLING_DATA_NO_FIELDS", "No se enviaron campos para actualizar.");
  }

  const { data, error } = await context.adminClient
    .from("organization_subscriptions")
    .update(updates)
    .eq("organization_id", context.organizationId)
    .select("id, invoice_name, doc_type, doc_number, updated_at")
    .single();

  if (error || !data) {
    throwApiError(500, "BILLING_DATA_UPDATE_ERROR", error?.message ?? "No se pudo actualizar.");
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return data;
});
