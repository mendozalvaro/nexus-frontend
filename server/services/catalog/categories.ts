import { createError } from "h3";

import type { TenantContext } from "../../utils/tenant-context";

export interface CatalogCategoryRow {
  id: string;
  name: string;
  type: "product" | "service";
  parent_id: string | null;
  is_active: boolean;
}

export interface CatalogCategory {
  id: string;
  name: string;
  type: "product" | "service";
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  linkedCount: number;
}

export const getCatalogCategories = async (
  context: TenantContext
): Promise<CatalogCategory[]> => {
  const { data, error } = await context.adminClient
    .from("categories")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("name", { ascending: true })
    .returns<CatalogCategoryRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  const categoryMap = new Map((data ?? []).map((category) => [category.id, category]));
  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type as "product" | "service",
    parentId: category.parent_id,
    parentName: category.parent_id ? (categoryMap.get(category.parent_id)?.name ?? null) : null,
    isActive: category.is_active ?? true,
    linkedCount: 0,
  }));
};

export interface CreateCatalogCategoryPayload {
  name: string;
  parentId: string | null;
  type: "product" | "service";
}

export const createCatalogCategory = async (
  context: TenantContext,
  payload: CreateCatalogCategoryPayload
): Promise<{ success: boolean; categoryId: string }> => {
  const { data, error } = await context.adminClient
    .from("categories")
    .insert({
      organization_id: context.organizationId,
      name: payload.name,
      parent_id: payload.parentId,
      type: payload.type,
    })
    .select("id")
    .returns<{ id: string }[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    categoryId: data?.[0]?.id ?? "",
  };
};

export const updateCatalogCategory = async (
  context: TenantContext,
  categoryId: string,
  payload: CreateCatalogCategoryPayload
): Promise<{ success: boolean; categoryId: string }> => {
  const { error } = await context.adminClient
    .from("categories")
    .update({
      name: payload.name,
      parent_id: payload.parentId,
      type: payload.type,
    })
    .eq("id", categoryId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    categoryId,
  };
};

export const updateCatalogCategoryStatus = async (
  context: TenantContext,
  categoryId: string,
  isActive: boolean
): Promise<{ success: boolean; categoryId: string }> => {
  const { error } = await context.adminClient
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", categoryId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    categoryId,
  };
};