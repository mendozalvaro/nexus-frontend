import { createError } from "h3";

import type { TenantContext } from "../../utils/tenant-context";

export interface CatalogServiceRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  duration_minutes: number;
  category_id: string | null;
  is_active: boolean;
}

export interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
  isActive: boolean;
}

export const getCatalogServices = async (
  context: TenantContext
): Promise<CatalogService[]> => {
  const { data, error } = await context.adminClient
    .from("services")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("name", { ascending: true })
    .returns<CatalogServiceRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return (data ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    imageUrl: service.image_url ?? null,
    price: Number(service.price),
    durationMinutes: service.duration_minutes,
    categoryId: service.category_id,
    isActive: service.is_active ?? true,
  }));
};

export interface CreateCatalogServicePayload {
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
}

export const createCatalogService = async (
  context: TenantContext,
  payload: CreateCatalogServicePayload
): Promise<{ success: boolean; serviceId: string }> => {
  const { data, error } = await context.adminClient
    .from("services")
    .insert({
      organization_id: context.organizationId,
      name: payload.name,
      description: payload.description,
      image_url: payload.imageUrl ?? null,
      price: payload.price,
      duration_minutes: payload.durationMinutes,
      category_id: payload.categoryId,
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
    serviceId: data?.[0]?.id ?? "",
  };
};

export const updateCatalogService = async (
  context: TenantContext,
  serviceId: string,
  payload: CreateCatalogServicePayload
): Promise<{ success: boolean; serviceId: string }> => {
  const { error } = await context.adminClient
    .from("services")
    .update({
      name: payload.name,
      description: payload.description,
      image_url: payload.imageUrl ?? null,
      price: payload.price,
      duration_minutes: payload.durationMinutes,
      category_id: payload.categoryId,
    })
    .eq("id", serviceId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    serviceId,
  };
};

export const updateCatalogServiceStatus = async (
  context: TenantContext,
  serviceId: string,
  isActive: boolean
): Promise<{ success: boolean; serviceId: string }> => {
  const { error } = await context.adminClient
    .from("services")
    .update({ is_active: isActive })
    .eq("id", serviceId)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    success: true,
    serviceId,
  };
};