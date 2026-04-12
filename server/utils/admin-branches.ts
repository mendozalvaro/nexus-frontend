import { createError } from "h3";
import { z } from "zod";

import type { Database, Json } from "@/types/database.types";

import { readValidatedAdminBody, requireAdminContext } from "./admin-users";

type AdminUserContext = Awaited<ReturnType<typeof requireAdminContext>>;
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const businessHourDaySchema = z.object({
  isOpen: z.boolean(),
  open: z.string().regex(timePattern, "Ingresa una hora de apertura válida."),
  close: z.string().regex(timePattern, "Ingresa una hora de cierre válida."),
}).superRefine((value, context) => {
  if (value.isOpen && value.open >= value.close) {
    context.addIssue({
      code: "custom",
      path: ["close"],
      message: "La hora de cierre debe ser posterior a la apertura.",
    });
  }
});

const businessHoursSchema = z.object({
  monday: businessHourDaySchema,
  tuesday: businessHourDaySchema,
  wednesday: businessHourDaySchema,
  thursday: businessHourDaySchema,
  friday: businessHourDaySchema,
  saturday: businessHourDaySchema,
  sunday: businessHourDaySchema,
});

export const branchSettingsSchema = z.object({
  businessHours: businessHoursSchema,
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(3, "El nombre de la sucursal es obligatorio."),
  code: z.string().trim().min(2, "El código debe tener al menos 2 caracteres.").max(12, "El código no puede superar 12 caracteres.").regex(/^[A-Za-z0-9-]+$/, "Usa solo letras, números y guiones."),
  address: z.string().trim().max(240, "La dirección no puede superar 240 caracteres.").default(""),
  phone: z.string().trim().max(32, "El teléfono no puede superar 32 caracteres.").default(""),
  settings: branchSettingsSchema,
});

export const updateBranchSchema = createBranchSchema;

export const branchStatusSchema = z.object({
  isActive: z.boolean(),
});

export const transferStockSchema = z.object({
  sourceBranchId: z.string().uuid("La sucursal origen es inválida."),
  destinationBranchId: z.string().uuid("La sucursal destino es inválida."),
  productId: z.string().uuid("El producto seleccionado es inválido."),
  quantity: z.number().int("La cantidad debe ser un entero.").positive("La cantidad debe ser mayor a cero."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional().default(""),
}).superRefine((value, context) => {
  if (value.sourceBranchId === value.destinationBranchId) {
    context.addIssue({
      code: "custom",
      path: ["destinationBranchId"],
      message: "Debes elegir una sucursal destino diferente.",
    });
  }
});

export interface BranchAdminContext extends AdminUserContext {
  capabilities: AdminUserContext["capabilities"] & {
    maxBranches: number;
    currentBranchesCount: number;
    canCreateBranch: boolean;
    canTransferStock: boolean;
  };
  featureMultiBranch: boolean;
  featureInventoryTransfer: boolean;
}

const sanitizeNullableString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const sanitizeBranchCode = (value: string): string => value.trim().toUpperCase();

const getPlanFeatures = async (
  adminClient: AdminUserContext["adminClient"],
  organizationId: string,
): Promise<Pick<SubscriptionPlanRow, "feature_multi_branch" | "feature_inventory_transfer">> => {
  const { data: subscription, error: subscriptionError } = await adminClient
    .from("organization_subscriptions")
    .select("id, plan_id, organization_id, status, current_period_end")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"] satisfies Array<NonNullable<SubscriptionRow["status"]>>)
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<SubscriptionRow, "id" | "plan_id" | "organization_id" | "status" | "current_period_end">>();

  if (subscriptionError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el plan activo de la organización.",
    });
  }

  if (!subscription?.plan_id) {
    return {
      feature_inventory_transfer: false,
      feature_multi_branch: false,
    };
  }

  const { data: plan, error: planError } = await adminClient
    .from("subscription_plans")
    .select("feature_multi_branch, feature_inventory_transfer")
    .eq("id", subscription.plan_id)
    .maybeSingle<Pick<SubscriptionPlanRow, "feature_multi_branch" | "feature_inventory_transfer">>();

  if (planError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar las capacidades detalladas del plan.",
    });
  }

  return {
    feature_inventory_transfer: plan?.feature_inventory_transfer ?? false,
    feature_multi_branch: plan?.feature_multi_branch ?? false,
  };
};

export const requireBranchAdminContext = async (event: Parameters<typeof requireAdminContext>[0]): Promise<BranchAdminContext> => {
  const context = await requireAdminContext(event);
  const { data: capabilityData, error: capabilityError } = await context.adminClient.rpc(
    "get_organization_capabilities",
    { input_org_id: context.organizationId },
  );

  if (capabilityError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar las capacidades del plan actual para sucursales.",
    });
  }

  const features = await getPlanFeatures(context.adminClient, context.organizationId);
  const capabilityRecord = typeof capabilityData === "object" && capabilityData !== null
    ? capabilityData as Record<string, unknown>
    : {};

  return {
    ...context,
    capabilities: {
      ...context.capabilities,
      maxBranches: typeof capabilityRecord.maxBranches === "number" ? capabilityRecord.maxBranches : 1,
      currentBranchesCount: typeof capabilityRecord.currentBranchesCount === "number" ? capabilityRecord.currentBranchesCount : 0,
      canCreateBranch: typeof capabilityRecord.canCreateBranch === "boolean" ? capabilityRecord.canCreateBranch : false,
      canTransferStock: typeof capabilityRecord.canTransferStock === "boolean" ? capabilityRecord.canTransferStock : false,
    },
    featureInventoryTransfer: features.feature_inventory_transfer ?? false,
    featureMultiBranch: features.feature_multi_branch ?? false,
  };
};

export const assertBranchCreationAllowed = (context: BranchAdminContext) => {
  if (!context.capabilities.canCreateBranch || context.capabilities.currentBranchesCount >= context.capabilities.maxBranches) {
    throw createError({
      statusCode: 409,
      statusMessage: `Tu plan alcanzó el límite de ${context.capabilities.maxBranches} sucursal(es). Actualiza la suscripción para crear más.`,
    });
  }

  if (context.capabilities.currentBranchesCount >= 1 && !context.featureMultiBranch) {
    throw createError({
      statusCode: 403,
      statusMessage: "Tu plan actual no habilita múltiples sucursales. Actualiza la suscripción para agregar una nueva.",
    });
  }
};

export const assertStockTransferAllowed = (context: BranchAdminContext) => {
  if (!context.featureInventoryTransfer || !context.capabilities.canTransferStock) {
    throw createError({
      statusCode: 403,
      statusMessage: "Tu plan actual no habilita transferencias de stock entre sucursales.",
    });
  }
};

export const assertUniqueBranchCode = async (
  adminClient: BranchAdminContext["adminClient"],
  organizationId: string,
  code: string,
  excludingBranchId?: string,
) => {
  let query = adminClient
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", code);

  if (excludingBranchId) {
    query = query.neq("id", excludingBranchId);
  }

  const { data, error } = await query.maybeSingle<Pick<BranchRow, "id">>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la unicidad del código de sucursal.",
    });
  }

  if (data?.id) {
    throw createError({
      statusCode: 409,
      statusMessage: "Ya existe una sucursal con ese código dentro de la organización.",
    });
  }
};

export const getAdminBranchOrThrow = async (
  adminClient: BranchAdminContext["adminClient"],
  organizationId: string,
  branchId: string,
): Promise<BranchRow> => {
  const { data, error } = await adminClient
    .from("branches")
    .select("id, organization_id, name, code, address, phone, settings, is_active, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("id", branchId)
    .maybeSingle<BranchRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo cargar la sucursal solicitada.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "La sucursal solicitada no existe dentro de la organización actual.",
    });
  }

  return data;
};

export const sanitizeBranchPayload = (payload: z.output<typeof createBranchSchema>) => ({
  name: payload.name.trim(),
  code: sanitizeBranchCode(payload.code),
  address: sanitizeNullableString(payload.address),
  phone: sanitizeNullableString(payload.phone),
  settings: payload.settings as Json,
});

export const ensureAtLeastOneActiveBranch = async (
  adminClient: BranchAdminContext["adminClient"],
  organizationId: string,
  branchId: string,
  nextIsActive: boolean,
) => {
  if (nextIsActive) {
    return;
  }

  const { count, error } = await adminClient
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .neq("id", branchId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el estado global de las sucursales.",
    });
  }

  if ((count ?? 0) === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "No puedes desactivar la última sucursal activa de la organización.",
    });
  }
};

export const readValidatedBranchBody = readValidatedAdminBody;
