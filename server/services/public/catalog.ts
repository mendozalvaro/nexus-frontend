import { createError } from "h3";

import { buildPublicAdminClient } from "./client";

import type { H3Event } from "h3";
import type { Database } from "@/types/database.types";
import type { PublicCatalogResponse } from "@/types/public-catalog";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

const defaultMarketingData = {
  heroTitle: "Coleccion curada para una temporada suave y elegante.",
  heroSubtitle: "Prendas pensadas para dias largos, noches tibias y looks faciles de combinar.",
  about: "Boutique femenina con prendas versatiles, siluetas fluidas y una seleccion pensada para compra por mensaje.",
  whatsapp: "",
  instagram: "",
  city: "La Paz",
  shippingMessage: "Envios a todo Bolivia y retiro en boutique con coordinacion previa.",
  seasonalNote: "Editamos el catalogo segun temporada para mantener piezas utiles, calidas y comerciales.",
};

const readMarketingString = (source: OrganizationRow["billing_data"], key: string, fallback: string) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return fallback;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
};

const normalizeInstagramHandle = (value: string) => value.replace(/^@+/, "").trim();

export async function getPublicCatalogBySlug(event: H3Event, slug: string): Promise<PublicCatalogResponse> {
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
    throw createError({
      statusCode: 500,
      statusMessage: organizationError.message,
    });
  }

  if (!organization || organization.status !== "active") {
    throw createError({
      statusCode: 404,
      statusMessage: "No encontramos esta tienda.",
    });
  }

  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    adminClient
      .from("categories")
      .select("id, name, description, parent_id, type, is_active")
      .eq("organization_id", organization.id)
      .eq("type", "product")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<CategoryRow[]>(),
    adminClient
      .from("products")
      .select("id, sku, name, description, image_url, sale_price, category_id, is_active")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .returns<ProductRow[]>(),
  ]);

  const firstError = categoriesError ?? productsError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const categoriesList = categories ?? [];
  const categoryMap = new Map(categoriesList.map((category) => [category.id, category]));
  const billingData = organization.billing_data;
  const instagram = normalizeInstagramHandle(readMarketingString(billingData, "instagram", defaultMarketingData.instagram));

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug ?? normalizedSlug,
      logoUrl: organization.logo_url,
      address: organization.address,
      currencyCode: organization.currency_code,
      country: organization.country,
    },
    marketing: {
      heroTitle: readMarketingString(billingData, "hero_title", defaultMarketingData.heroTitle),
      heroSubtitle: readMarketingString(billingData, "hero_subtitle", defaultMarketingData.heroSubtitle),
      about: readMarketingString(billingData, "about", defaultMarketingData.about),
      whatsapp: readMarketingString(billingData, "whatsapp", defaultMarketingData.whatsapp),
      instagram,
      city: readMarketingString(billingData, "city", defaultMarketingData.city),
      shippingMessage: readMarketingString(billingData, "shipping_message", defaultMarketingData.shippingMessage),
      seasonalNote: readMarketingString(billingData, "seasonal_note", defaultMarketingData.seasonalNote),
    },
    categories: categoriesList.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      parentId: category.parent_id,
      parentName: category.parent_id ? (categoryMap.get(category.parent_id)?.name ?? null) : null,
    })),
    products: (products ?? []).map((product) => {
      const directCategory = product.category_id ? (categoryMap.get(product.category_id) ?? null) : null;
      const rootCategory = directCategory?.parent_id
        ? (categoryMap.get(directCategory.parent_id) ?? null)
        : directCategory;

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        imageUrl: product.image_url,
        salePrice: product.sale_price,
        categoryId: product.category_id,
        categoryName: rootCategory?.name ?? directCategory?.name ?? null,
        categoryGroupId: rootCategory?.id ?? directCategory?.id ?? null,
        categoryGroupName: rootCategory?.name ?? directCategory?.name ?? null,
        subcategoryId: directCategory?.parent_id ? directCategory.id : null,
        subcategoryName: directCategory?.parent_id ? directCategory.name : null,
      };
    }),
  };
}
