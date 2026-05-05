import { createError } from "h3";

import type { TenantContext } from "../../utils/tenant-context";

export interface CatalogProductRow {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  image_url: string | null;
  cost_price: number | null;
  sale_price: number;
  category_id: string | null;
  track_inventory: boolean;
  is_active: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
  isActive: boolean;
}

export interface CatalogProductFilters {
  searchQuery?: string;
}

export const getCatalogProducts = async (
  context: TenantContext,
  _filters?: CatalogProductFilters
): Promise<CatalogProduct[]> => {
  const { data, error } = await context.adminClient
    .from("products")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("name", { ascending: true })
    .returns<CatalogProductRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return (data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    imageUrl: product.image_url ?? null,
    costPrice: Number(product.cost_price ?? 0),
    salePrice: Number(product.sale_price),
    categoryId: product.category_id,
    trackInventory: product.track_inventory ?? true,
    isActive: product.is_active ?? true,
  }));
};

export interface CreateCatalogProductPayload {
  name: string;
  sku: string;
  description: string;
  imageUrl: string;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
}

export const createCatalogProduct = async (
  context: TenantContext,
  payload: CreateCatalogProductPayload
): Promise<{ success: boolean; productId: string }> => {
  const { data, error } = await context.adminClient
    .from("products")
    .insert({
      organization_id: context.organizationId,
      name: payload.name,
      sku: payload.sku,
      description: payload.description,
      image_url: payload.imageUrl ?? null,
      cost_price: payload.costPrice,
      sale_price: payload.salePrice,
      category_id: payload.categoryId,
      track_inventory: payload.trackInventory,
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
    productId: data?.[0]?.id ?? "",
  };
};

export const updateCatalogProduct = async (
  context: TenantContext,
  productId: string,
  payload: CreateCatalogProductPayload
): Promise<{ success: boolean; productId: string }> => {
  const { error } = await context.adminClient
    .from("products")
    .update({
      name: payload.name,
      sku: payload.sku,
      description: payload.description,
      image_url: payload.imageUrl ?? null,
      cost_price: payload.costPrice,
      sale_price: payload.salePrice,
      category_id: payload.categoryId,
      track_inventory: payload.trackInventory,
    })
    .eq("id", productId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    productId,
  };
};

export const updateCatalogProductStatus = async (
  context: TenantContext,
  productId: string,
  isActive: boolean
): Promise<{ success: boolean; productId: string }> => {
  const { error } = await context.adminClient
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    productId,
  };
};