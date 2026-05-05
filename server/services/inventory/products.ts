import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";

export interface InventoryProductRow {
  id: string;
  organization_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  track_inventory: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  costPrice: number;
  salePrice: number;
  trackInventory: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export const getInventoryProducts = async (
  context: InventoryContext
): Promise<InventoryProduct[]> => {
  const { data, error } = await context.adminClient
    .from("products")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("name", { ascending: true })
    .returns<InventoryProductRow[]>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const { data: categoriesData, error: categoriesError } = await context.adminClient
    .from("categories")
    .select("id, name")
    .eq("organization_id", context.organizationId)
    .eq("type", "product");

  if (categoriesError) {
    throw createError({ statusCode: 500, statusMessage: categoriesError.message });
  }

  const categoryMap = new Map((categoriesData ?? []).map((c) => [c.id, c.name]));

  return (data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    categoryId: product.category_id,
    categoryName: product.category_id ? categoryMap.get(product.category_id) ?? null : null,
    costPrice: product.cost_price ?? 0,
    salePrice: product.sale_price,
    trackInventory: product.track_inventory ?? true,
    isActive: product.is_active ?? true,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  }));
};

export const getInventoryProductOrThrow = async (
  context: InventoryContext,
  productId: string
): Promise<InventoryProduct> => {
  const { data: productData, error } = await context.adminClient
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("organization_id", context.organizationId)
    .returns<InventoryProductRow[]>()
    .single();

  if (error || !productData) {
    throw createError({ statusCode: 404, statusMessage: "Producto no encontrado." });
  }

  let categoryName: string | null = null;
  if (productData.category_id) {
    const { data: catData } = await context.adminClient
      .from("categories")
      .select("name")
      .eq("id", productData.category_id)
      .returns<{ name: string }[]>()
      .single();
    categoryName = catData?.name ?? null;
  }

  return {
    id: productData.id,
    name: productData.name,
    sku: productData.sku,
    description: productData.description,
    categoryId: productData.category_id,
    categoryName,
    costPrice: productData.cost_price ?? 0,
    salePrice: productData.sale_price,
    trackInventory: productData.track_inventory ?? true,
    isActive: productData.is_active ?? true,
    createdAt: productData.created_at,
    updatedAt: productData.updated_at,
  };
};

export interface CreateInventoryProductPayload {
  name: string;
  sku: string | null;
  description: string | null;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
}

export const createInventoryProduct = async (
  context: InventoryContext,
  payload: CreateInventoryProductPayload
): Promise<{ success: boolean; productId: string }> => {
  const { data, error } = await context.adminClient
    .from("products")
    .insert({
      organization_id: context.organizationId,
      name: payload.name.trim(),
      sku: payload.sku?.trim() || null,
      description: payload.description?.trim() || null,
      cost_price: payload.costPrice,
      sale_price: payload.salePrice,
      category_id: payload.categoryId,
      track_inventory: payload.trackInventory,
      is_active: true,
    })
    .select("id")
    .returns<{ id: string }[]>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    success: true,
    productId: data?.[0]?.id ?? "",
  };
};

export const updateInventoryProduct = async (
  context: InventoryContext,
  productId: string,
  payload: CreateInventoryProductPayload
): Promise<{ success: boolean; productId: string }> => {
  const { error } = await context.adminClient
    .from("products")
    .update({
      name: payload.name.trim(),
      sku: payload.sku?.trim() || null,
      description: payload.description?.trim() || null,
      cost_price: payload.costPrice,
      sale_price: payload.salePrice,
      category_id: payload.categoryId,
      track_inventory: payload.trackInventory,
    })
    .eq("id", productId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    success: true,
    productId,
  };
};

export const updateInventoryProductStatus = async (
  context: InventoryContext,
  productId: string,
  isActive: boolean
): Promise<{ success: boolean; productId: string }> => {
  const { error } = await context.adminClient
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    success: true,
    productId,
  };
};