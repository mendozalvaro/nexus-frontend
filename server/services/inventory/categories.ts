import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";

export interface InventoryCategoryRow {
  id: string;
  organization_id: string;
  name: string;
  type: "product" | "service";
  parent_id: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface InventoryCategory {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  productsCount: number;
}

export const getInventoryCategories = async (
  context: InventoryContext
): Promise<InventoryCategory[]> => {
  const { data, error } = await context.adminClient
    .from("categories")
    .select("id, name, parent_id, is_active")
    .eq("organization_id", context.organizationId)
    .eq("type", "product")
    .order("name", { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const categoryRows = data ?? [];
  const categoryMap = new Map(categoryRows.map((c) => [c.id, c]));

  const { data: countsData, error: countsError } = await context.adminClient
    .from("products")
    .select("category_id")
    .eq("organization_id", context.organizationId)
    .not("category_id", "is", null);

  if (countsError) {
    throw createError({ statusCode: 500, statusMessage: countsError.message });
  }

  const countMap = new Map<string, number>();
  for (const product of countsData ?? []) {
    if (product.category_id) {
      countMap.set(product.category_id, (countMap.get(product.category_id) ?? 0) + 1);
    }
  }

  return categoryRows.map((category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parent_id,
    parentName: category.parent_id ? categoryMap.get(category.parent_id)?.name ?? null : null,
    isActive: category.is_active ?? true,
    productsCount: countMap.get(category.id) ?? 0,
  }));
};

export interface CreateInventoryCategoryPayload {
  name: string;
  parentId: string | null;
}

export const createInventoryCategory = async (
  context: InventoryContext,
  payload: CreateInventoryCategoryPayload
): Promise<{ success: boolean; categoryId: string }> => {
  const { data, error } = await context.adminClient
    .from("categories")
    .insert({
      organization_id: context.organizationId,
      name: payload.name.trim(),
      parent_id: payload.parentId,
      type: "product",
      is_active: true,
    })
    .select("id")
    .returns<{ id: string }[]>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    success: true,
    categoryId: data?.[0]?.id ?? "",
  };
};

export const updateInventoryCategory = async (
  context: InventoryContext,
  categoryId: string,
  payload: CreateInventoryCategoryPayload
): Promise<{ success: boolean; categoryId: string }> => {
  const { error } = await context.adminClient
    .from("categories")
    .update({
      name: payload.name.trim(),
      parent_id: payload.parentId,
    })
    .eq("id", categoryId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    success: true,
    categoryId,
  };
};

export const updateInventoryCategoryStatus = async (
  context: InventoryContext,
  categoryId: string,
  isActive: boolean
): Promise<{ success: boolean; categoryId: string }> => {
  const { error } = await context.adminClient
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", categoryId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    success: true,
    categoryId,
  };
};