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
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
type InventoryMutationRow = Database["public"]["Functions"]["apply_inventory_stock_mutation"]["Returns"][number];
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
  reason: z.string().trim().min(3, "Debes indicar el motivo de la transferencia."),
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional().default(""),
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

export interface InventoryMutationResult {
  stockId: string;
  previousQuantity: number;
  newQuantity: number;
  reservedQuantity: number;
  minStockLevel: number;
}

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

  let allowedBranchIds = profile.branch_id ? [profile.branch_id] : [];
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

    const uniqueBranchIds = new Set<string>(allowedBranchIds);
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

export const getInventoryBranchOrThrow = async (
  context: InventoryContext,
  branchId: string,
): Promise<BranchRow> => {
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

