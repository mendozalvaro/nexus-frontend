import { z } from "zod";

import { requireClientTenantContext } from "../../utils/tenant-context";
import { updateClientProfile } from "../../services/clientProfile";
import type { ClientProfileState } from "@/types/client";

const updateClientSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  lastName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().min(7).max(30).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  billingData: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export default defineEventHandler(async (event) => {
  const context = await requireClientTenantContext(event);

  const body = await readBody(event);
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const result = await updateClientProfile(event, context.userId, context.organizationId, parsed.data);
  return { profile: result as ClientProfileState };
});
