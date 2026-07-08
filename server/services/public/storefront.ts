import { createError } from "h3";

import { getStorefrontTemplate } from "@/utils/storefront";

import { buildPublicAdminClient, type PublicAdminClient } from "./client";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";
import type {
  PublicStorefrontResponse,
  StorefrontBusinessType,
  StorefrontColorPresetKey,
  StorefrontTemplateKey,
} from "@/types/storefront";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type StorefrontSettingsRow = Database["public"]["Tables"]["organization_storefront_settings"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];

const readContactString = (source: OrganizationRow["billing_data"], key: string) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const isStorefrontTemplateKey = (value: string): value is StorefrontTemplateKey =>
  getStorefrontTemplate(value as StorefrontTemplateKey).key === value;

const isStorefrontColorPresetKey = (value: string): value is StorefrontColorPresetKey =>
  value === "neutral" || value === "warm" || value === "natural" || value === "premium" || value === "industrial" || value === "marine";

const fetchCategoryMap = async (adminClient: PublicAdminClient, organizationId: string) => {
  const { data } = await adminClient
    .from("categories")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  const map = new Map<string, string>();
  if (data) {
    for (const cat of data) {
      map.set(cat.id, cat.name);
    }
  }
  return map;
};

const mapPublicItems = async (
  event: H3Event,
  organizationId: string,
  businessType: StorefrontBusinessType,
) => {
  const adminClient = buildPublicAdminClient(event);

  if (businessType === "service") {
    const { data, error } = await adminClient
      .from("services")
      .select("id, name, description, image_url, price, duration_minutes, category_id, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .returns<ServiceRow[]>();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    const catMap = await fetchCategoryMap(adminClient, organizationId);

    return (data ?? []).map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: `${item.duration_minutes} min`,
      description: item.description,
      price: item.price,
      imageUrl: item.image_url,
      badge: item.category_id ? (catMap.get(item.category_id) ?? null) : null,
      meta: `${item.duration_minutes} min`,
    }));
  }

  if (businessType === "lodging") {
    const { data, error } = await adminClient
      .from("rooms")
      .select("id, room_number, notes, base_price, location, floor, category_id, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("room_number", { ascending: true })
      .returns<RoomRow[]>();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    const catMap = await fetchCategoryMap(adminClient, organizationId);

    return (data ?? []).map((item) => {
      const location = item.location?.trim() || (item.floor !== null ? `Piso ${item.floor}` : null);

      return {
        id: item.id,
        title: `Habitacion ${item.room_number}`,
        subtitle: location,
        description: item.notes,
        price: item.base_price,
        imageUrl: null,
        badge: item.category_id ? (catMap.get(item.category_id) ?? null) : null,
        meta: location,
      };
    });
  }

  const { data, error } = await adminClient
    .from("products")
    .select("id, name, description, image_url, sale_price, sku, category_id, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .returns<ProductRow[]>();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const catMap = await fetchCategoryMap(adminClient, organizationId);

  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.name,
    subtitle: item.sku,
    description: item.description,
    price: item.sale_price,
    imageUrl: item.image_url,
    badge: item.category_id ? (catMap.get(item.category_id) ?? null) : null,
    meta: item.sku,
  }));
};

export async function getPublicStorefrontBySlug(event: H3Event, slug: string): Promise<PublicStorefrontResponse> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    throw createError({ statusCode: 400, statusMessage: "Slug invalido." });
  }

  const adminClient = buildPublicAdminClient(event);

  const { data: organization, error: organizationError } = await adminClient
    .from("organizations")
    .select("id, name, slug, logo_url, address, currency_code, country, billing_data, is_active, status")
    .eq("slug", normalizedSlug)
    .eq("is_active", true)
    .maybeSingle<OrganizationRow>();

  if (organizationError) {
    throw createError({ statusCode: 500, statusMessage: organizationError.message });
  }

  if (!organization || organization.status !== "active") {
    throw createError({ statusCode: 404, statusMessage: "No encontramos esta tienda." });
  }

  const { data: settings, error: settingsError } = await adminClient
    .from("organization_storefront_settings")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("is_published", true)
    .maybeSingle<StorefrontSettingsRow>();

  if (settingsError) {
    throw createError({ statusCode: 500, statusMessage: settingsError.message });
  }

  if (!settings) {
    throw createError({ statusCode: 404, statusMessage: "La tienda virtual no esta publicada." });
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug ?? normalizedSlug,
      logoUrl: organization.logo_url,
      address: organization.address,
      currencyCode: organization.currency_code,
      country: organization.country,
      phone: readContactString(organization.billing_data, "phone"),
      email: readContactString(organization.billing_data, "email"),
      whatsapp: readContactString(organization.billing_data, "whatsapp"),
      instagram: readContactString(organization.billing_data, "instagram"),
    },
    settings: {
      organizationId: settings.organization_id,
      slug: organization.slug ?? normalizedSlug,
      businessType: settings.business_type,
      templateKey: isStorefrontTemplateKey(settings.template_key) ? settings.template_key : "product-grocery",
      colorPresetKey: isStorefrontColorPresetKey(settings.color_preset_key) ? settings.color_preset_key : "neutral",
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      accentColor: settings.accent_color,
      companyDescription: settings.company_description,
      heroImageUrl: settings.hero_image_url,
      isPublished: settings.is_published,
      updatedAt: settings.updated_at,
    },
    template: getStorefrontTemplate(
      isStorefrontTemplateKey(settings.template_key) ? settings.template_key : "product-grocery",
    ),
    items: await mapPublicItems(event, organization.id, settings.business_type),
  };
}
