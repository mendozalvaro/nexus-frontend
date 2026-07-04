import { z } from "zod";

import { setCacheHeaders } from "../../utils/cache";
import { throwApiError } from "../../utils/http-error";
import { getStorefrontSettings, updateStorefrontSettings } from "../../services/storefront-settings";
import { requireStaffTenantContext } from "../../utils/tenant-context";

const storefrontPatchSchema = z.object({
  slug: z.string().trim().min(4).max(50),
  businessType: z.enum(["product", "service", "lodging"]),
  templateKey: z.enum([
    "product-grocery",
    "product-fashion",
    "product-parts",
    "service-salon",
    "service-clinic",
    "service-technical",
    "lodging-hostal",
    "lodging-hotel",
    "lodging-cabin",
  ]),
  colorPresetKey: z.enum(["neutral", "warm", "natural", "premium", "industrial", "marine"]),
  primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
  companyDescription: z.string().trim().max(600).nullable(),
  isPublished: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const body = await readBody(event);
  const parsed = storefrontPatchSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "SETTINGS_STOREFRONT_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido para tienda virtual.",
      parsed.error.flatten(),
    );
  }

  const response = parsed.data
    ? await updateStorefrontSettings(context, parsed.data)
    : await getStorefrontSettings(context);

  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return response;
});
