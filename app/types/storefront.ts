export type StorefrontBusinessType = "product" | "service" | "lodging";
export const STOREFRONT_BUSINESS_TYPES = ["product", "service", "lodging"] as const;

export type StorefrontItemLayout =
  | "card-grid"
  | "list-row"
  | "compact"
  | "mosaic"
  | "showcase"
  | "table"
  | "carousel";

export type StorefrontTemplateKey =
  | "product-grocery"
  | "product-fashion"
  | "product-parts"
  | "service-salon"
  | "service-clinic"
  | "service-technical"
  | "lodging-hostal"
  | "lodging-hotel"
  | "lodging-cabin";

export type StorefrontColorPresetKey =
  | "neutral"
  | "warm"
  | "natural"
  | "premium"
  | "industrial"
  | "marine";
export const STOREFRONT_COLOR_PRESET_KEYS = ["neutral", "warm", "natural", "premium", "industrial", "marine"] as const;
export const STOREFRONT_TEMPLATE_KEYS = [
  "product-grocery",
  "product-fashion",
  "product-parts",
  "service-salon",
  "service-clinic",
  "service-technical",
  "lodging-hostal",
  "lodging-hotel",
  "lodging-cabin",
] as const;

export interface StorefrontColorPreset {
  key: StorefrontColorPresetKey;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface StorefrontTemplateDesign {
  pattern: string;
  styleName: string;
  styleKeywords: string[];
  effects: string[];
  headingFont: string;
  bodyFont: string;
  recommendedColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  defaultHeroImage?: string;
}

export interface StorefrontTemplateDefinition {
  key: StorefrontTemplateKey;
  businessType: StorefrontBusinessType;
  label: string;
  shortLabel: string;
  sectionTitle: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  design: StorefrontTemplateDesign;
}

export interface StorefrontSettings {
  organizationId: string;
  slug: string;
  businessType: StorefrontBusinessType;
  templateKey: StorefrontTemplateKey;
  colorPresetKey: StorefrontColorPresetKey;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyDescription: string | null;
  heroImageUrl: string | null;
  isPublished: boolean;
  updatedAt: string | null;
}

export interface StorefrontAccess {
  canView: boolean;
  canManage: boolean;
  canPublish: boolean;
  canCustomColors: boolean;
  maxSites: number;
  allowedTemplateKeys: StorefrontTemplateKey[];
  reason: string | null;
}

export interface PublicStorefrontOrganization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currencyCode: string | null;
  country: string | null;
  whatsapp: string | null;
  instagram: string | null;
}

export interface PublicStorefrontItem {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  badge: string | null;
  meta: string | null;
}

export interface PublicStorefrontResponse {
  organization: PublicStorefrontOrganization;
  settings: StorefrontSettings;
  template: StorefrontTemplateDefinition;
  items: PublicStorefrontItem[];
}
