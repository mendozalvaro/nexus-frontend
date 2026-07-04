import { z } from "zod";

import { requireStaffTenantContext } from "../../utils/tenant-context";
import { updateOrganizationCustomer } from "../../services/orgCustomers";

const paramsSchema = z.object({
  clientId: z.string().uuid(),
}).strict();

const bodySchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().min(7).max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  billingName: z.string().trim().max(180).optional().nullable(),
  billingEmail: z.string().trim().email().optional().nullable(),
  billingPhone: z.string().trim().max(30).optional().nullable(),
  documentType: z.enum(["CI", "NIT", "Pasaporte", "Otro"]).optional().nullable(),
  documentNumber: z.string().trim().max(40).optional().nullable(),
  billingData: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
}).strict().superRefine((value, context) => {
  if ((value.documentType && !value.documentNumber) || (value.documentNumber && !value.documentType)) {
    context.addIssue({
      code: "custom",
      path: !value.documentType ? ["documentType"] : ["documentNumber"],
      message: "Tipo y numero de documento deben registrarse juntos.",
    });
  }
});

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);

  const params = paramsSchema.safeParse(getRouterParams(event));
  if (!params.success) {
    throw createError({
      statusCode: 400,
      statusMessage: params.error.issues[0]?.message ?? "Parámetros inválidos.",
    });
  }

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  await updateOrganizationCustomer(context, params.data.clientId, parsed.data);
  return { success: true };
});
