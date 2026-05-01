import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database, Json } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type InventoryMovementInsert = Database["public"]["Tables"]["inventory_movements"]["Insert"];
type InventoryTransferInsert = Database["public"]["Tables"]["inventory_transfers"]["Insert"];
type InventoryTransferRow = Database["public"]["Tables"]["inventory_transfers"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type InventoryMutationRow = Database["public"]["Functions"]["apply_inventory_stock_mutation"]["Returns"][number];
type RoleModulePermissionRow = Database["public"]["Tables"]["role_module_permissions"]["Row"];
type AdminClient = ReturnType<typeof createClient<Database>>;

type StaffRole = Extract<UserRole, "admin" | "manager">;

const numericField = z.coerce.number().finite("Ingresa un valor numérico válido.");

export const productSchema = z.object({
  name: z.string().trim().min(3, "El nombre del producto es obligatorio."),
  sku: z.string().trim().max(64, "El SKU no puede superar 64 caracteres.").optional().default(""),
  description: z.string().trim().max(240, "La descripción no puede superar 240 caracteres.").optional().default(""),
  costPrice: numericField.min(0, "El precio costo no puede ser negativo."),
  salePrice: numericField.min(0, "El precio venta no puede ser negativo."),
  categoryId: z.string().uuid().nullable(),
  trackInventory: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "El nombre de la categoría es obligatorio."),
  parentId: z.string().uuid().nullable().default(null),
});

export const stockAdjustmentSchema = z.object({
  branchId: z.string().uuid("La sucursal seleccionada es inválida."),
  productId: z.string().uuid("El producto seleccionado es inválido."),
  mode: z.enum(["set", "add", "remove"]),
  quantity: z.coerce.number().int("La cantidad debe ser un entero.").positive("La cantidad debe ser mayor a cero."),
  minStockLevel: z.coerce.number().int("El mínimo debe ser un entero.").min(0, "El stock mínimo no puede ser negativo.").nullable().optional(),
  reason: z.string().trim().min(3, "Debes indicar el motivo del ajuste."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional().default(""),
});

export const stockTransferSchema = z.object({
  sourceBranchId: z.string().uuid("La sucursal origen es inválida."),
  destinationBranchId: z.string().uuid("La sucursal destino es inválida."),
  productId: z.string().uuid("El producto seleccionado es inválido."),
  quantity: z.coerce.number().int("La cantidad debe ser un entero.").positive("La cantidad debe ser mayor a cero."),
  observations: z.string().trim().min(3, "Debes indicar las observaciones de la transferencia."),
  internalNote: z.string().trim().max(240, "La nota interna no puede superar 240 caracteres.").optional().default(""),
});

const inventoryBatchLineSchema = z.object({
  productId: z.string().uuid("El producto seleccionado es inválido."),
  quantity: z.coerce.number().int("La cantidad debe ser un entero.").positive("La cantidad debe ser mayor a cero."),
});

export const stockAdjustmentBatchSchema = z.object({
  idempotencyKey: z.string().trim().min(8, "La llave de idempotencia es requerida.").max(120, "La llave de idempotencia es demasiado larga."),
  branchId: z.string().uuid("La sucursal seleccionada es inválida."),
  mode: z.enum(["set", "add", "remove"]),
  reason: z.string().trim().min(3, "Debes indicar el motivo del ajuste."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional().default(""),
  lines: z.array(z.object({
    productId: z.string().uuid("El producto seleccionado es inválido."),
    quantity: z.coerce.number().int("La cantidad debe ser un entero.").positive("La cantidad debe ser mayor a cero."),
    minStockLevel: z.coerce.number().int("El mínimo debe ser un entero.").min(0, "El stock mínimo no puede ser negativo.").nullable().optional(),
  })).min(1, "Debes incluir al menos un producto.").max(50, "Solo se permiten hasta 50 líneas por operación."),
});

export const stockTransferBatchSchema = z.object({
  idempotencyKey: z.string().trim().min(8, "La llave de idempotencia es requerida.").max(120, "La llave de idempotencia es demasiado larga."),
  sourceBranchId: z.string().uuid("La sucursal origen es inválida."),
  destinationBranchId: z.string().uuid("La sucursal destino es inválida."),
  observations: z.string().trim().min(3, "Debes indicar las observaciones de la transferencia."),
  internalNote: z.string().trim().max(240, "La nota interna no puede superar 240 caracteres.").optional().default(""),
  lines: z.array(inventoryBatchLineSchema).min(1, "Debes incluir al menos un producto.").max(50, "Solo se permiten hasta 50 líneas por operación."),
});

export const inventoryTransferFiltersSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  status: z.enum(["all", "pending", "received", "cancelled"]).optional().default("all"),
});

export interface InventoryContext {
  adminClient: AdminClient;
  organizationId: string;
  userId: string;
  role: StaffRole;
  profile: ProfileRow & {
    organization_id: string;
    role: StaffRole;
  };
  allowedBranchIds: string[];
  canTransferStock: boolean;
}

export type InventoryModuleAction =
  | "can_view"
  | "can_create"
  | "can_edit"
  | "can_delete"
  | "can_manage";

export interface InventoryMutationResult {
  stockId: string;
  previousQuantity: number;
  newQuantity: number;
  reservedQuantity: number;
  minStockLevel: number;
}

export interface InventoryBatchValidationRow {
  lineIndex: number;
  productId: string | null;
  quantity: number;
  isValid: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  currentQuantity: number | null;
  nextQuantity: number | null;
}

export interface InventoryBatchExecutionResult {
  batchId: string;
  processedCount: number;
  idempotent: boolean;
}

export type InventoryDocumentCodeType = "ING" | "SAL" | "AJU" | "TRA";

export interface InventoryAdjustmentBatchLine {
  productId: string;
  quantity: number;
  minStockLevel?: number | null;
}

export interface InventoryTransferBatchLine {
  productId: string;
  quantity: number;
}

export interface InventoryBatchNormalization<TLine> {
  originalLines: number;
  normalizedLines: number;
  mergedProducts: number;
  lines: TLine[];
}

const hasDefinedMinStock = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

const buildBatchNormalizationWarnings = (
  originalLines: number,
  normalizedLines: number,
  mergedProducts: number,
): string[] => {
  if (mergedProducts <= 0 || normalizedLines >= originalLines) {
    return [];
  }

  return [
    `Se consolidaron ${originalLines - normalizedLines} línea(s) repetidas en ${mergedProducts} producto(s).`,
  ];
};

export const normalizeInventoryAdjustmentBatchLines = (
  mode: "set" | "add" | "remove",
  lines: InventoryAdjustmentBatchLine[],
): InventoryBatchNormalization<InventoryAdjustmentBatchLine> => {
  const normalizedMap = new Map<string, InventoryAdjustmentBatchLine>();
  const occurrences = new Map<string, number>();

  for (const line of lines) {
    occurrences.set(line.productId, (occurrences.get(line.productId) ?? 0) + 1);
    const existing = normalizedMap.get(line.productId);

    if (!existing) {
      normalizedMap.set(line.productId, {
        productId: line.productId,
        quantity: line.quantity,
        minStockLevel: line.minStockLevel ?? null,
      });
      continue;
    }

    if (mode === "set") {
      existing.quantity = line.quantity;
    } else {
      existing.quantity += line.quantity;
    }

    if (hasDefinedMinStock(line.minStockLevel)) {
      existing.minStockLevel = line.minStockLevel;
    }
  }

  const normalizedLines = Array.from(normalizedMap.values());
  const mergedProducts = Array.from(occurrences.values()).filter((count) => count > 1).length;

  return {
    originalLines: lines.length,
    normalizedLines: normalizedLines.length,
    mergedProducts,
    lines: normalizedLines,
  };
};

export const normalizeInventoryTransferBatchLines = (
  lines: InventoryTransferBatchLine[],
): InventoryBatchNormalization<InventoryTransferBatchLine> => {
  const normalizedMap = new Map<string, InventoryTransferBatchLine>();
  const occurrences = new Map<string, number>();

  for (const line of lines) {
    occurrences.set(line.productId, (occurrences.get(line.productId) ?? 0) + 1);
    const existing = normalizedMap.get(line.productId);

    if (!existing) {
      normalizedMap.set(line.productId, {
        productId: line.productId,
        quantity: line.quantity,
      });
      continue;
    }

    existing.quantity += line.quantity;
  }

  const normalizedLines = Array.from(normalizedMap.values());
  const mergedProducts = Array.from(occurrences.values()).filter((count) => count > 1).length;

  return {
    originalLines: lines.length,
    normalizedLines: normalizedLines.length,
    mergedProducts,
    lines: normalizedLines,
  };
};

export const getInventoryBatchNormalizationWarnings = (
  normalization: InventoryBatchNormalization<unknown>,
): string[] =>
  buildBatchNormalizationWarnings(
    normalization.originalLines,
    normalization.normalizedLines,
    normalization.mergedProducts,
  );

export const generateInventoryDocumentCode = async (
  context: Pick<InventoryContext, "adminClient" | "organizationId">,
  docType: InventoryDocumentCodeType,
): Promise<string> => {
  const { data: organization, error: organizationError } = await context.adminClient
    .from("organizations")
    .select("billing_data")
    .eq("id", context.organizationId)
    .maybeSingle<Pick<OrganizationRow, "billing_data">>();

  if (organizationError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo cargar la configuracion de codigos de inventario.",
    });
  }

  const settings = organization?.billing_data;
  const settingsRecord = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};
  const rawPrefix = settingsRecord.inventory_code_prefix;
  const prefix = typeof rawPrefix === "string" && rawPrefix.trim().length > 0
    ? rawPrefix.trim().toUpperCase()
    : "INV";

  const { data, error } = await context.adminClient.rpc("next_inventory_document_code" as never, {
    p_organization_id: context.organizationId,
    p_doc_type: docType,
    p_prefix: prefix,
  } as never);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo generar el codigo de movimiento de inventario.",
    });
  }

  const code = typeof data === "string" ? data : null;
  if (!code) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se obtuvo un codigo de movimiento valido.",
    });
  }

  return code;
};

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se recibió un token de autenticación válido.",
    });
  }

  return header.slice("Bearer ".length);
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuración pública de Supabase está incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para gestionar inventario desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const ensureStaffRole = (role: UserRole | null): StaffRole => {
  if (role === "admin" || role === "manager") {
    return role;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "Solo administradores y managers pueden gestionar inventario.",
  });
};

const loadTransferFeature = async (
  adminClient: AdminClient,
  organizationId: string,
): Promise<boolean> => {
  const { data: subscription, error: subscriptionError } = await adminClient
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<SubscriptionRow, "plan_id">>();

  if (subscriptionError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el plan actual para inventario.",
    });
  }

  if (!subscription?.plan_id) {
    return false;
  }

  const { data: plan, error: planError } = await adminClient
    .from("subscription_plans")
    .select("feature_inventory_transfer")
    .eq("id", subscription.plan_id)
    .maybeSingle<Pick<SubscriptionPlanRow, "feature_inventory_transfer">>();

  if (planError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la capacidad de transferencias del plan.",
    });
  }

  return plan?.feature_inventory_transfer ?? false;
};

export const requireInventoryContext = async (event: H3Event): Promise<InventoryContext> => {
  const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig(event);
  const token = getBearerToken(event);

  const authClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se pudo validar la sesión del usuario.",
    });
  }

  const adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile?.organization_id || profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo validar el perfil para gestionar inventario.",
    });
  }

  const role = ensureStaffRole(profile.role);

  let allowedBranchIds: string[] = [];
  if (role === "admin") {
    const { data: branches, error: branchesError } = await adminClient
      .from("branches")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .returns<Array<Pick<BranchRow, "id">>>();

    if (branchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar las sucursales del inventario global.",
      });
    }

    allowedBranchIds = (branches ?? []).map((branch) => branch.id);
  } else {
    const { data: assignments, error: assignmentsError } = await adminClient
      .from("employee_branch_assignments")
      .select("branch_id")
      .eq("user_id", profile.id)
      .returns<Array<Pick<AssignmentRow, "branch_id">>>();

    if (assignmentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar las sucursales asignadas del manager.",
      });
    }

    const uniqueBranchIds = new Set<string>();
    for (const assignment of assignments ?? []) {
      uniqueBranchIds.add(assignment.branch_id);
    }

    allowedBranchIds = Array.from(uniqueBranchIds);
  }

  return {
    adminClient,
    organizationId: profile.organization_id,
    userId: profile.id,
    role,
    profile: {
      ...profile,
      organization_id: profile.organization_id,
      role,
    },
    allowedBranchIds,
    canTransferStock: await loadTransferFeature(adminClient, profile.organization_id),
  };
};

export const readValidatedInventoryBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  return parsed.data;
};

export const assertInventoryBranchAccess = (context: InventoryContext, branchId: string) => {
  if (!context.allowedBranchIds.includes(branchId)) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes acceso a la sucursal seleccionada para operar inventario.",
    });
  }
};

export const assertTransferFeature = (context: InventoryContext) => {
  if (!context.canTransferStock) {
    throw createError({
      statusCode: 403,
      statusMessage: "Tu plan actual no habilita transferencias entre sucursales.",
    });
  }
};

const hasDefaultInventoryAccess = (role: StaffRole, action: InventoryModuleAction): boolean => {
  if (role === "admin") {
    return true;
  }

  if (role === "manager") {
    switch (action) {
      case "can_view":
      case "can_create":
      case "can_edit":
        return true;
      default:
        return false;
    }
  }

  return false;
};

export const assertInventoryModuleAccess = async (
  context: InventoryContext,
  action: InventoryModuleAction = "can_view",
) => {
  const roleId = context.profile.role_id;
  if (!roleId) {
    if (hasDefaultInventoryAccess(context.role, action)) {
      return;
    }

    throw createError({
      statusCode: 403,
      statusMessage: "Tu rol no tiene permiso para operar inventario.",
    });
  }

  const { data, error } = await context.adminClient
    .from("role_module_permissions")
    .select("can_view, can_create, can_edit, can_delete, can_manage")
    .eq("role_id", roleId)
    .eq("module_key", "inventory")
    .maybeSingle<Pick<RoleModulePermissionRow, "can_view" | "can_create" | "can_edit" | "can_delete" | "can_manage">>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar los permisos del modulo inventario.",
    });
  }

  const hasDefaultAccess = hasDefaultInventoryAccess(context.role, action);
  if (!data) {
    if (hasDefaultAccess) {
      return;
    }

    throw createError({
      statusCode: 403,
      statusMessage: "Tu rol no tiene permiso para operar inventario.",
    });
  }

  const allowed = data.can_manage === true || data[action] === true;
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para ejecutar esta accion en inventario.",
    });
  }
};

export const getInventoryBranchOrThrow = async (
  context: InventoryContext,
  branchId: string,
  options?: { requireActive?: boolean },
): Promise<BranchRow> => {
  const requireActive = options?.requireActive ?? true;
  const { data, error } = await context.adminClient
    .from("branches")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", branchId)
    .maybeSingle<BranchRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la sucursal seleccionada.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "La sucursal seleccionada no existe en tu organización.",
    });
  }

  if (requireActive && data.is_active === false) {
    throw createError({
      statusCode: 409,
      statusMessage: "La sucursal seleccionada se encuentra inactiva para operaciones de inventario.",
    });
  }

  return data;
};

export const getInventoryProductOrThrow = async (
  context: InventoryContext,
  productId: string,
): Promise<ProductRow> => {
  const { data, error } = await context.adminClient
    .from("products")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", productId)
    .maybeSingle<ProductRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el producto seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El producto seleccionado no existe en tu organización.",
    });
  }

  return data;
};

export const getProductCategoryOrThrow = async (
  context: InventoryContext,
  categoryId: string,
): Promise<CategoryRow> => {
  const { data, error } = await context.adminClient
    .from("categories")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", categoryId)
    .eq("type", "product")
    .maybeSingle<CategoryRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la categoría seleccionada.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "La categoría seleccionada no existe o no pertenece a productos.",
    });
  }

  return data;
};

export const getInventoryStockOrThrow = async (
  context: InventoryContext,
  branchId: string,
  productId: string,
): Promise<InventoryStockRow | null> => {
  const { data, error } = await context.adminClient
    .from("inventory_stock")
    .select("*")
    .eq("branch_id", branchId)
    .eq("product_id", productId)
    .maybeSingle<InventoryStockRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el stock del producto en la sucursal seleccionada.",
    });
  }

  return data;
};

export const assertUniqueSKU = async (
  context: InventoryContext,
  sku: string | null,
  excludingProductId?: string,
) => {
  if (!sku) {
    return;
  }

  let query = context.adminClient
    .from("products")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("sku", sku)
    .limit(1);

  if (excludingProductId) {
    query = query.neq("id", excludingProductId);
  }

  const { data, error } = await query;

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la unicidad del SKU.",
    });
  }

  if ((data ?? []).length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Ya existe un producto con ese SKU dentro de tu organización.",
    });
  }
};

export const assertUniqueProductCategoryName = async (
  context: InventoryContext,
  name: string,
  excludingCategoryId?: string,
) => {
  let query = context.adminClient
    .from("categories")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("type", "product")
    .ilike("name", name)
    .limit(1);

  if (excludingCategoryId) {
    query = query.neq("id", excludingCategoryId);
  }

  const { data, error } = await query;

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la unicidad de la categoría.",
    });
  }

  if ((data ?? []).length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Ya existe una categoría de productos con ese nombre.",
    });
  }
};

export const upsertInventoryStock = async (
  context: InventoryContext,
  payload: {
    branchId: string;
    productId: string;
    quantity: number;
    minStockLevel?: number | null;
  },
): Promise<InventoryStockRow> => {
  const existingStock = await getInventoryStockOrThrow(context, payload.branchId, payload.productId);

  if (existingStock) {
    const { data, error } = await context.adminClient
      .from("inventory_stock")
      .update({
        quantity: payload.quantity,
        min_stock_level: payload.minStockLevel ?? existingStock.min_stock_level ?? 5,
      })
      .eq("id", existingStock.id)
      .select("*")
      .single<InventoryStockRow>();

    if (error || !data) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo actualizar el stock del producto.",
      });
    }

    return data;
  }

  const { data, error } = await context.adminClient
    .from("inventory_stock")
    .insert({
      branch_id: payload.branchId,
      product_id: payload.productId,
      quantity: payload.quantity,
      min_stock_level: payload.minStockLevel ?? 5,
      reserved_quantity: 0,
    })
    .select("*")
    .single<InventoryStockRow>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo crear el stock del producto en la sucursal.",
    });
  }

  return data;
};

export const applyInventoryStockMutation = async (
  context: Pick<InventoryContext, "adminClient">,
  payload: {
    branchId: string;
    productId: string;
    mode: "set" | "add" | "remove";
    quantity: number;
    minStockLevel?: number | null;
    requireAvailable?: boolean;
  },
): Promise<InventoryMutationResult> => {
  const { data, error } = await context.adminClient.rpc("apply_inventory_stock_mutation", {
    p_branch_id: payload.branchId,
    p_product_id: payload.productId,
    p_mode: payload.mode,
    p_quantity: payload.quantity,
    p_min_stock_level: payload.minStockLevel ?? undefined,
    p_require_available: payload.requireAvailable ?? false,
  });

  if (error) {
    const message = error.message ?? "No se pudo mutar el stock del producto.";

    if (message.includes("INSUFFICIENT_AVAILABLE_STOCK")) {
      throw createError({
        statusCode: 409,
        statusMessage: "No hay stock disponible suficiente para completar la operación.",
      });
    }

    if (message.includes("INSUFFICIENT_STOCK") || message.includes("NEGATIVE_STOCK_NOT_ALLOWED")) {
      throw createError({
        statusCode: 409,
        statusMessage: "La operación deja el stock en negativo, lo cual no está permitido.",
      });
    }

    if (message.includes("INVENTORY_STOCK_NOT_FOUND")) {
      throw createError({
        statusCode: 404,
        statusMessage: "No existe stock cargado para este producto en la sucursal seleccionada.",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: message,
    });
  }

  const row = (data as InventoryMutationRow[] | null)?.[0];
  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: "La operación de inventario no devolvió un resultado válido.",
    });
  }

  return {
    stockId: row.stock_id,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    reservedQuantity: row.reserved_quantity,
    minStockLevel: row.min_stock_level,
  };
};

const normalizeInventoryMutationError = (message: string): never => {
  if (message.includes("INSUFFICIENT_AVAILABLE_STOCK")) {
    throw createError({
      statusCode: 409,
      statusMessage: "No hay stock disponible suficiente para completar la operación.",
    });
  }

  if (message.includes("INSUFFICIENT_STOCK") || message.includes("NEGATIVE_STOCK_NOT_ALLOWED")) {
    throw createError({
      statusCode: 409,
      statusMessage: "La operación deja el stock en negativo, lo cual no está permitido.",
    });
  }

  if (message.includes("INVENTORY_STOCK_NOT_FOUND")) {
    throw createError({
      statusCode: 404,
      statusMessage: "No existe stock cargado para este producto en la sucursal seleccionada.",
    });
  }

  if (message.includes("INVALID_BATCH_LINES")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes enviar entre 1 y 50 líneas válidas.",
    });
  }

  throw createError({
    statusCode: 500,
    statusMessage: message,
  });
};

export const runInventoryAdjustBatchPrecheck = async (
  context: Pick<InventoryContext, "adminClient" | "organizationId">,
  payload: {
    branchId: string;
    mode: "set" | "add" | "remove";
    lines: Array<{ productId: string; quantity: number }>;
  },
): Promise<InventoryBatchValidationRow[]> => {
  const { data, error } = await context.adminClient.rpc("inventory_adjust_batch_precheck" as never, {
    p_organization_id: context.organizationId,
    p_branch_id: payload.branchId,
    p_mode: payload.mode,
    p_lines: payload.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
  } as never);

  if (error) {
    normalizeInventoryMutationError(error.message ?? "No se pudo prevalidar el lote de ajustes.");
  }

  return ((data as Array<{
    line_index: number;
    product_id: string | null;
    quantity: number;
    is_valid: boolean;
    error_code: string | null;
    error_message: string | null;
    current_quantity: number | null;
    next_quantity: number | null;
  }> | null) ?? []).map((row) => ({
    lineIndex: row.line_index,
    productId: row.product_id,
    quantity: row.quantity,
    isValid: row.is_valid,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    currentQuantity: row.current_quantity,
    nextQuantity: row.next_quantity,
  }));
};

export const runInventoryAdjustBatchExecute = async (
  context: Pick<InventoryContext, "adminClient" | "organizationId" | "userId">,
  payload: {
    idempotencyKey: string;
    branchId: string;
    mode: "set" | "add" | "remove";
    reason: string;
    note: string;
    lines: Array<{ productId: string; quantity: number; minStockLevel?: number | null }>;
  },
): Promise<InventoryBatchExecutionResult> => {
  const { data, error } = await context.adminClient.rpc("inventory_adjust_batch_execute" as never, {
    p_organization_id: context.organizationId,
    p_user_id: context.userId,
    p_idempotency_key: payload.idempotencyKey,
    p_branch_id: payload.branchId,
    p_mode: payload.mode,
    p_reason: payload.reason,
    p_note: payload.note,
    p_lines: payload.lines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
      min_stock_level: line.minStockLevel ?? null,
    })),
  } as never);

  if (error) {
    normalizeInventoryMutationError(error.message ?? "No se pudo ejecutar el lote de ajustes.");
  }

  const row = (data as Array<{ batch_id: string; processed_count: number; idempotent: boolean }> | null)?.[0];
  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se recibió respuesta válida del lote de ajustes.",
    });
  }

  return {
    batchId: row.batch_id,
    processedCount: row.processed_count,
    idempotent: row.idempotent,
  };
};

export const runInventoryTransferBatchPrecheck = async (
  context: Pick<InventoryContext, "adminClient" | "organizationId">,
  payload: {
    sourceBranchId: string;
    destinationBranchId: string;
    lines: Array<{ productId: string; quantity: number }>;
  },
): Promise<InventoryBatchValidationRow[]> => {
  const { data, error } = await context.adminClient.rpc("inventory_transfer_batch_precheck" as never, {
    p_organization_id: context.organizationId,
    p_source_branch_id: payload.sourceBranchId,
    p_destination_branch_id: payload.destinationBranchId,
    p_lines: payload.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
  } as never);

  if (error) {
    normalizeInventoryMutationError(error.message ?? "No se pudo prevalidar el lote de transferencias.");
  }

  return ((data as Array<{
    line_index: number;
    product_id: string | null;
    quantity: number;
    is_valid: boolean;
    error_code: string | null;
    error_message: string | null;
    current_quantity: number | null;
    next_quantity: number | null;
  }> | null) ?? []).map((row) => ({
    lineIndex: row.line_index,
    productId: row.product_id,
    quantity: row.quantity,
    isValid: row.is_valid,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    currentQuantity: row.current_quantity,
    nextQuantity: row.next_quantity,
  }));
};

export const runInventoryTransferBatchCreate = async (
  context: Pick<InventoryContext, "adminClient" | "organizationId" | "userId">,
  payload: {
    idempotencyKey: string;
    sourceBranchId: string;
    destinationBranchId: string;
    observations: string;
    internalNote: string;
    lines: Array<{ productId: string; quantity: number }>;
  },
): Promise<InventoryBatchExecutionResult> => {
  const { data, error } = await context.adminClient.rpc("inventory_transfer_batch_create" as never, {
    p_organization_id: context.organizationId,
    p_user_id: context.userId,
    p_idempotency_key: payload.idempotencyKey,
    p_source_branch_id: payload.sourceBranchId,
    p_destination_branch_id: payload.destinationBranchId,
    p_observations: payload.observations,
    p_internal_note: payload.internalNote,
    p_lines: payload.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
  } as never);

  if (error) {
    normalizeInventoryMutationError(error.message ?? "No se pudo crear el lote de transferencias.");
  }

  const row = (data as Array<{ batch_id: string; processed_count: number; idempotent: boolean }> | null)?.[0];
  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se recibió respuesta válida del lote de transferencias.",
    });
  }

  return {
    batchId: row.batch_id,
    processedCount: row.processed_count,
    idempotent: row.idempotent,
  };
};

export const runInventoryTransferBatchReceive = async (
  context: Pick<InventoryContext, "adminClient" | "organizationId" | "userId">,
  batchId: string,
): Promise<InventoryBatchExecutionResult> => {
  const { data, error } = await context.adminClient.rpc("inventory_transfer_batch_receive" as never, {
    p_organization_id: context.organizationId,
    p_user_id: context.userId,
    p_batch_id: batchId,
  } as never);

  if (error) {
    normalizeInventoryMutationError(error.message ?? "No se pudo recepcionar el lote de transferencias.");
  }

  const row = (data as Array<{ batch_id: string; processed_count: number; idempotent: boolean }> | null)?.[0];
  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se recibió respuesta válida de la recepción del lote.",
    });
  }

  return {
    batchId: row.batch_id,
    processedCount: row.processed_count,
    idempotent: row.idempotent,
  };
};

export const insertInventoryMovement = async (
  context: InventoryContext,
  movement: InventoryMovementInsert,
) => {
  const { error } = await context.adminClient
    .from("inventory_movements")
    .insert(movement);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo registrar el movimiento de inventario.",
    });
  }
};

export const insertInventoryTransfer = async (
  context: InventoryContext,
  transfer: InventoryTransferInsert,
): Promise<InventoryTransferRow> => {
  const { data, error } = await context.adminClient
    .from("inventory_transfers")
    .insert(transfer)
    .select("*")
    .single<InventoryTransferRow>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? "No se pudo registrar la transferencia de inventario.",
    });
  }

  return data;
};

export const insertInventoryAudit = async (
  context: InventoryContext,
  payload: {
    recordId: string | null;
    event: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    extraContext?: Record<string, unknown>;
  },
) => {
  const auditPayload: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
    user_id: context.userId,
    action: "UPDATE",
    table_name: "inventory_stock",
    record_id: payload.recordId,
    old_data: (payload.oldData ?? null) as Json,
    new_data: (payload.newData ?? null) as Json,
    context: {
      event: payload.event,
      organization_id: context.organizationId,
      role: context.role,
      ...(payload.extraContext ?? {}),
    },
  };

  await context.adminClient.from("audit_logs").insert(auditPayload);
};

export const mapInventoryError = (error: unknown, fallbackMessage: string): never => {
  const message = error instanceof Error ? error.message : fallbackMessage;

  throw createError({
    statusCode: 500,
    statusMessage: message,
  });
};
