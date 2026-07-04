import { z } from "zod";

import { throwApiError } from "../utils/http-error";
import { requireStaffTenantContext } from "../utils/tenant-context";
import { setCacheHeaders } from "../utils/cache";

const siatSchema = z.object({
  razon_social: z.string().trim().min(1).max(200).optional(),
  nit: z.string().trim().min(1).max(50).optional(),
  regimen_tributario: z.enum(["general", "simplificado", "especial"]).optional(),
  actividad_economica: z.string().trim().max(200).optional(),
  sucursal_siat: z.string().trim().max(100).optional(),
  direccion_matriz: z.string().trim().max(300).optional(),
  codigo_autorizacion: z.string().trim().max(100).optional(),
  punto_venta: z.string().trim().max(50).optional(),
  sistema_facturacion: z.enum(["propio", "terceros", "siat_linea"]).optional(),
  codigo_sistema: z.string().trim().max(50).optional(),
  resolucion_numero: z.string().trim().max(100).optional(),
  is_active: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  if (context.role !== "admin") {
    throwApiError(403, "SIAT_ADMIN_ONLY", "Solo administradores pueden configurar SIAT.");
  }

  const body = await readBody(event);
  const parsed = siatSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "SIAT_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para configuracion SIAT.",
      parsed.error.flatten(),
    );
  }

  const updates = parsed.data!;

  if (Object.keys(updates).length === 0) {
    throwApiError(400, "SIAT_NO_FIELDS", "No se enviaron campos para actualizar.");
  }

  const client = context.adminClient as any;

  const { data: existing, error: fetchError } = await client
    .from("organization_siat_config")
    .select("id")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  let result;

  if (fetchError || !existing) {
    result = await client
      .from("organization_siat_config")
      .insert({
        organization_id: context.organizationId,
        ...updates,
      })
      .select("*")
      .single();
  } else {
    result = await client
      .from("organization_siat_config")
      .update(updates)
      .eq("organization_id", context.organizationId)
      .select("*")
      .single();
  }

  if (result.error || !result.data) {
    throwApiError(500, "SIAT_UPDATE_ERROR", result.error?.message ?? "No se pudo actualizar la configuracion SIAT.");
  }

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return result.data;
});
