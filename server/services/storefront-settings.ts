import { createError } from "h3";

import { createDefaultStorefrontSettings, getStorefrontColorPreset, getStorefrontTemplate, getTemplatesForBusinessType } from "@/utils/storefront";

import type { Database } from "@/types/database.types";
import type {
  StorefrontAccess,
  StorefrontBusinessType,
  StorefrontColorPresetKey,
  StorefrontSettings,
  StorefrontTemplateKey,
} from "@/types/storefront";
import type { TenantContext } from "../utils/tenant-context";
import { getOrganizationSlugValidationError, normalizeOrganizationSlug } from "../utils/organization-slug";

type StorefrontSettingsRow = Database["public"]["Tables"]["organization_storefront_settings"]["Row"];
type StorefrontEntitlementsRow = Database["public"]["Tables"]["organization_storefront_entitlements"]["Row"];

const NO_ACCESS: StorefrontAccess = {
  canView: false,
  canManage: false,
  canPublish: false,
  canCustomColors: false,
  maxSites: 0,
  allowedTemplateKeys: [],
  reason: "Tu plan actual no incluye Tienda Virtual.",
};

const isMissingStorefrontTableError = (error: { message?: string } | null | undefined) =>
  (error?.message ?? "").includes("organization_storefront_");

const isStorefrontBusinessType = (value: string | null | undefined): value is StorefrontBusinessType =>
  value === "product" || value === "service" || value === "lodging";

const isStorefrontTemplateKey = (value: string): value is StorefrontTemplateKey =>
  getStorefrontTemplate(value as StorefrontTemplateKey).key === value;

const isStorefrontColorPresetKey = (value: string): value is StorefrontColorPresetKey =>
  getStorefrontColorPreset(value as StorefrontColorPresetKey).key === value;

const resolveOrganizationBusinessType = async (
  context: TenantContext,
  fallback: StorefrontBusinessType = "product",
): Promise<StorefrontBusinessType> => {
  const { data, error } = await context.adminClient
    .from("organization_business_types")
    .select("business_type")
    .eq("organization_id", context.organizationId)
    .limit(1);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const value = data?.[0]?.business_type;
  return isStorefrontBusinessType(value) ? value : fallback;
};

const resolvePlanSlug = async (context: TenantContext) => {
  const { data: subscription, error: subscriptionError } = await context.adminClient
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (subscriptionError) {
    throw createError({ statusCode: 500, statusMessage: subscriptionError.message });
  }

  if (!subscription?.plan_id) {
    return "emprende" as const;
  }

  const { data: plan, error: planError } = await context.adminClient
    .from("subscription_plans")
    .select("slug")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  if (planError) {
    throw createError({ statusCode: 500, statusMessage: planError.message });
  }

  return plan?.slug === "crecimiento" || plan?.slug === "enterprise" ? plan.slug : "emprende";
};

const resolveAllowedTemplateKeys = (
  businessType: StorefrontBusinessType,
  templateKeys?: string[] | null,
): StorefrontTemplateKey[] => {
  const defaults = getTemplatesForBusinessType(businessType).map((template) => template.key);

  if (!templateKeys?.length) {
    return defaults;
  }

  const allowed = templateKeys.filter(isStorefrontTemplateKey);
  return allowed.filter((key) => getStorefrontTemplate(key).businessType === businessType);
};

const mapSettingsRow = (
  row: StorefrontSettingsRow,
  slug: string,
): StorefrontSettings => ({
  organizationId: row.organization_id,
  slug,
  businessType: row.business_type,
  templateKey: isStorefrontTemplateKey(row.template_key) ? row.template_key : "product-grocery",
  colorPresetKey: isStorefrontColorPresetKey(row.color_preset_key) ? row.color_preset_key : "neutral",
  primaryColor: row.primary_color,
  secondaryColor: row.secondary_color,
  accentColor: row.accent_color,
  companyDescription: row.company_description,
  heroImageUrl: row.hero_image_url,
  isPublished: row.is_published,
  updatedAt: row.updated_at,
});

export async function getStorefrontAccess(
  context: TenantContext,
  businessType?: StorefrontBusinessType,
): Promise<StorefrontAccess> {
  const planSlug = await resolvePlanSlug(context);

  if (planSlug === "emprende") {
    return NO_ACCESS;
  }

  const resolvedBusinessType = businessType ?? await resolveOrganizationBusinessType(context);

  if (planSlug === "crecimiento") {
    return {
      canView: true,
      canManage: true,
      canPublish: true,
      canCustomColors: false,
      maxSites: 1,
      allowedTemplateKeys: resolveAllowedTemplateKeys(resolvedBusinessType),
      reason: null,
    };
  }

  const { data: entitlements, error } = await context.adminClient
    .from("organization_storefront_entitlements")
    .select("*")
    .eq("organization_id", context.organizationId)
    .maybeSingle<StorefrontEntitlementsRow>();

  if (error) {
    if (isMissingStorefrontTableError(error)) {
      return {
        ...NO_ACCESS,
        reason: "Aplica la migracion de Tienda Virtual para habilitar esta funcion.",
      };
    }

    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  if (!entitlements?.can_view || entitlements.max_sites < 1) {
    return {
      ...NO_ACCESS,
      reason: "Tu plan Enterprise requiere habilitacion individual para Tienda Virtual.",
    };
  }

  return {
    canView: entitlements.can_view,
    canManage: entitlements.can_manage,
    canPublish: entitlements.can_publish,
    canCustomColors: entitlements.can_custom_colors,
    maxSites: entitlements.max_sites,
    allowedTemplateKeys: resolveAllowedTemplateKeys(resolvedBusinessType, entitlements.template_keys),
    reason: null,
  };
}

export async function getStorefrontSettings(context: TenantContext) {
  const { data: organization, error: organizationError } = await context.adminClient
    .from("organizations")
    .select("id, slug")
    .eq("id", context.organizationId)
    .single();

  if (organizationError || !organization) {
    throw createError({ statusCode: 500, statusMessage: organizationError?.message ?? "No se pudo cargar la organizacion." });
  }

  const { data: row, error } = await context.adminClient
    .from("organization_storefront_settings")
    .select("*")
    .eq("organization_id", context.organizationId)
    .maybeSingle<StorefrontSettingsRow>();

  if (error) {
    if (isMissingStorefrontTableError(error)) {
      return {
        settings: createDefaultStorefrontSettings(
          context.organizationId,
          normalizeOrganizationSlug(organization.slug ?? ""),
          await resolveOrganizationBusinessType(context),
        ),
        access: {
          ...NO_ACCESS,
          reason: "Aplica la migracion de Tienda Virtual para habilitar esta funcion.",
        },
      };
    }

    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const businessType = isStorefrontBusinessType(row?.business_type)
    ? row.business_type
    : await resolveOrganizationBusinessType(context);

  const access = await getStorefrontAccess(context, businessType);
  const slug = normalizeOrganizationSlug(organization.slug ?? "");
  const settings = row
    ? mapSettingsRow(row, slug)
    : createDefaultStorefrontSettings(context.organizationId, slug, businessType);

  if (access.allowedTemplateKeys.length && !access.allowedTemplateKeys.includes(settings.templateKey)) {
    settings.templateKey = access.allowedTemplateKeys[0] ?? settings.templateKey;
  }

  return { settings, access };
}

export interface UpdateStorefrontPayload {
  slug: string;
  businessType: StorefrontBusinessType;
  templateKey: StorefrontTemplateKey;
  colorPresetKey: StorefrontSettings["colorPresetKey"];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
  isPublished: boolean;
}

export async function updateStorefrontSettings(
  context: TenantContext,
  payload: UpdateStorefrontPayload,
) {
  if (context.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Solo administradores pueden gestionar la tienda virtual." });
  }

  const slug = normalizeOrganizationSlug(payload.slug);
  const slugError = getOrganizationSlugValidationError(slug);
  if (slugError) {
    throw createError({ statusCode: 400, statusMessage: slugError });
  }

  const access = await getStorefrontAccess(context, payload.businessType);
  if (!access.canManage) {
    throw createError({ statusCode: 403, statusMessage: access.reason ?? "Tu plan no permite administrar Tienda Virtual." });
  }

  if (access.allowedTemplateKeys.length && !access.allowedTemplateKeys.includes(payload.templateKey)) {
    throw createError({ statusCode: 400, statusMessage: "La plantilla elegida no esta disponible para este plan." });
  }

  if (getStorefrontTemplate(payload.templateKey).businessType !== payload.businessType) {
    throw createError({ statusCode: 400, statusMessage: "La plantilla no coincide con el tipo de negocio seleccionado." });
  }

  const { data: existingSlug, error: slugQueryError } = await context.adminClient
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .neq("id", context.organizationId)
    .maybeSingle();

  if (slugQueryError) {
    throw createError({ statusCode: 500, statusMessage: slugQueryError.message });
  }

  if (existingSlug) {
    throw createError({ statusCode: 409, statusMessage: "Esta direccion virtual ya esta en uso." });
  }

  const colorPreset = getStorefrontColorPreset(payload.colorPresetKey);
  const colors = access.canCustomColors
    ? {
        primary_color: payload.primaryColor,
        secondary_color: payload.secondaryColor,
        accent_color: payload.accentColor,
      }
    : {
        primary_color: colorPreset.primary,
        secondary_color: colorPreset.secondary,
        accent_color: colorPreset.accent,
      };

  const published = access.canPublish ? payload.isPublished : false;

  const { error: organizationError } = await context.adminClient
    .from("organizations")
    .update({ slug })
    .eq("id", context.organizationId);

  if (organizationError) {
    throw createError({ statusCode: 500, statusMessage: organizationError.message });
  }

  const { error: settingsError } = await context.adminClient
    .from("organization_storefront_settings")
    .upsert({
      organization_id: context.organizationId,
      business_type: payload.businessType,
      template_key: payload.templateKey,
      color_preset_key: payload.colorPresetKey,
      company_description: payload.companyDescription?.trim() || null,
      is_published: published,
      ...colors,
    });

  if (settingsError) {
    throw createError({ statusCode: 500, statusMessage: settingsError.message });
  }

  return await getStorefrontSettings(context);
}
