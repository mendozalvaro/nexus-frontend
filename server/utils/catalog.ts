import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type AdminClient = ReturnType<typeof createClient<Database>>;

type CatalogRole = Extract<UserRole, "admin" | "manager">;
type CategoryType = "product" | "service";

const numericField = z.coerce.number().finite("Ingresa un valor numerico valido.");

export const catalogProductSchema = z.object({
  name: z.string().trim().min(3, "El nombre del producto es obligatorio."),
  sku: z.string().trim().max(64, "El SKU no puede superar 64 caracteres.").optional().default(""),
  description: z.string().trim().max(240, "La descripcion no puede superar 240 caracteres.").optional().default(""),
  imageUrl: z.string().trim().url("La URL de imagen no es valida.").or(z.literal("")).optional().default(""),
  costPrice: numericField.min(0, "El costo no puede ser negativo."),
  salePrice: numericField.min(0, "El precio de venta no puede ser negativo."),
  categoryId: z.string().uuid().nullable(),
  trackInventory: z.boolean().default(true),
});

export const catalogServiceSchema = z.object({
  name: z.string().trim().min(3, "El nombre del servicio es obligatorio."),
  description: z.string().trim().max(240, "La descripcion no puede superar 240 caracteres.").optional().default(""),
  imageUrl: z.string().trim().url("La URL de imagen no es valida.").or(z.literal("")).optional().default(""),
  price: numericField.min(0, "El precio no puede ser negativo."),
  durationMinutes: z.coerce.number().int("La duracion debe ser entera.").min(5, "La duracion minima es de 5 minutos."),
  categoryId: z.string().uuid().nullable(),
});

export const catalogCategorySchema = z.object({
  name: z.string().trim().min(2, "El nombre de la categoria es obligatorio."),
  parentId: z.string().uuid().nullable().default(null),
  type: z.enum(["product", "service"]),
});

export const catalogStatusSchema = z.object({
  isActive: z.boolean(),
});

export interface CatalogContext {
  adminClient: AdminClient;
  organizationId: string;
  userId: string;
  role: CatalogRole;
  profile: ProfileRow & {
    organization_id: string;
    role: CatalogRole;
  };
  allowedBranchIds: string[];
}

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se recibio un token de autenticacion valido.",
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
      statusMessage: "La configuracion publica de Supabase esta incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para gestionar catalogo.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const ensureCatalogRole = (role: UserRole | null): CatalogRole => {
  if (role === "admin" || role === "manager") {
    return role;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "Solo administradores y managers pueden gestionar catalogo.",
  });
};

export const requireCatalogContext = async (event: H3Event): Promise<CatalogContext> => {
  const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig(event);
  const token = getBearerToken(event);

  const authClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se pudo validar la sesion del usuario.",
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
      statusMessage: "No se pudo validar el perfil para gestionar catalogo.",
    });
  }

  const role = ensureCatalogRole(profile.role);

  let allowedBranchIds = profile.branch_id ? [profile.branch_id] : [];
  if (role === "admin") {
    const { data: branches, error: branchesError } = await adminClient
      .from("branches")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true);

    if (branchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar las sucursales visibles del catalogo.",
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
  };
};

export const readValidatedCatalogBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  return parsed.data;
};

export const getCatalogProductOrThrow = async (context: CatalogContext, productId: string): Promise<ProductRow> => {
  const { data, error } = await context.adminClient
    .from("products")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", productId)
    .maybeSingle<ProductRow>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "No se pudo validar el producto seleccionado." });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: "El producto seleccionado no existe en tu organizacion." });
  }

  return data;
};

export const getCatalogServiceOrThrow = async (context: CatalogContext, serviceId: string): Promise<ServiceRow> => {
  const { data, error } = await context.adminClient
    .from("services")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", serviceId)
    .maybeSingle<ServiceRow>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "No se pudo validar el servicio seleccionado." });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: "El servicio seleccionado no existe en tu organizacion." });
  }

  return data;
};

export const getCatalogCategoryOrThrow = async (
  context: CatalogContext,
  categoryId: string,
  type?: CategoryType,
): Promise<CategoryRow> => {
  let query = context.adminClient
    .from("categories")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", categoryId);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query.maybeSingle<CategoryRow>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "No se pudo validar la categoria seleccionada." });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: "La categoria seleccionada no existe en tu organizacion." });
  }

  return data;
};

export const assertCatalogUniqueSKU = async (context: CatalogContext, sku: string | null, excludingProductId?: string) => {
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
    throw createError({ statusCode: 500, statusMessage: "No se pudo validar la unicidad del SKU." });
  }

  if ((data ?? []).length > 0) {
    throw createError({ statusCode: 409, statusMessage: "Ya existe un producto con ese SKU." });
  }
};

export const assertCatalogUniqueServiceName = async (context: CatalogContext, name: string, excludingServiceId?: string) => {
  let query = context.adminClient
    .from("services")
    .select("id")
    .eq("organization_id", context.organizationId)
    .ilike("name", name)
    .limit(1);

  if (excludingServiceId) {
    query = query.neq("id", excludingServiceId);
  }

  const { data, error } = await query;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: "No se pudo validar la unicidad del servicio." });
  }

  if ((data ?? []).length > 0) {
    throw createError({ statusCode: 409, statusMessage: "Ya existe un servicio con ese nombre." });
  }
};

export const assertCatalogUniqueCategoryName = async (
  context: CatalogContext,
  name: string,
  type: CategoryType,
  excludingCategoryId?: string,
) => {
  let query = context.adminClient
    .from("categories")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("type", type)
    .ilike("name", name)
    .limit(1);

  if (excludingCategoryId) {
    query = query.neq("id", excludingCategoryId);
  }

  const { data, error } = await query;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: "No se pudo validar la unicidad de la categoria." });
  }

  if ((data ?? []).length > 0) {
    throw createError({ statusCode: 409, statusMessage: "Ya existe una categoria con ese nombre para este tipo." });
  }
};
