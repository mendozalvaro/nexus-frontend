import { z } from "zod";

import type { Json } from "@/types/database.types";
import {
  countriesList,
  countryDefaults,
  currenciesList,
  timezonesList,
} from "./constants";

export const ONBOARDING_STEPS = [
  "registration",
  "verification",
  "organization",
  "payment",
  "completed",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface CountryOption {
  code: string;
  label: string;
  currency: string;
  timezone: string;
  phonePrefix: string;
}

export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export interface TimezoneOption {
  value: string;
  label: string;
}

export const REGISTRATION_STORAGE_KEY = "nexuspos:onboarding:registration";
export const ORGANIZATION_STORAGE_KEY = "nexuspos:onboarding:organization";
export const PAYMENT_STORAGE_KEY = "nexuspos:onboarding:payment";
export const RESEND_STORAGE_KEY = "nexuspos:onboarding:resend";

export const COUNTRIES: CountryOption[] = [
  ...countriesList.map((country: (typeof countriesList)[number]) => ({
    code: country.value,
    label: country.label,
    currency: countryDefaults[country.value]?.currency ?? "USD",
    timezone: countryDefaults[country.value]?.timezone ?? "America/La_Paz",
    phonePrefix:
      {
        AR: "+54",
        BO: "+591",
        CL: "+56",
        CO: "+57",
        ES: "+34",
        MX: "+52",
        PE: "+51",
        US: "+1",
        UY: "+598",
      }[country.value] ?? "+1",
  })),
] as const;

export const CURRENCIES: CurrencyOption[] = [
  ...currenciesList.map((currency: (typeof currenciesList)[number]) => ({
    code: currency.value,
    label: currency.label.replace(/^[A-Z]{3}\s-\s/, ""),
    symbol:
      {
        ARS: "$",
        BOB: "Bs",
        CLP: "$",
        COP: "$",
        EUR: "EUR",
        MXN: "$",
        PEN: "S/",
        USD: "USD",
      }[currency.value] ?? currency.value,
  })),
] as const;

export const TIMEZONES: TimezoneOption[] = [...timezonesList] as const;

export const REGISTRATION_SCHEMA = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nombre muy corto")
    .max(100, "Nombre muy largo"),
  email: z
    .string()
    .trim()
    .email("Ingresa un email valido")
    .min(1, "El email es requerido"),
  password: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una mayuscula")
    .regex(/[0-9]/, "Debe incluir al menos un numero"),
  acceptTerms: z
    .boolean()
    .refine((value) => value === true, "Debes aceptar los terminos"),
  selectedPlan: z.enum(["emprende", "crecimiento", "enterprise"] as const),
  billingMode: z.enum(["monthly", "annual"] as const),
});

export const ORGANIZATION_SCHEMA = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre es demasiado largo")
    .regex(/^[a-zA-Z0-9\s\-_.,'¡!¿?]+$/, "Caracteres no permitidos"),
  businessType: z.enum(["products", "services", "both"], {
    message: "Selecciona el tipo de negocio",
  }),
  selectedPlan: z.enum(["emprende", "crecimiento", "enterprise"], {
    message: "Selecciona un plan",
  }),
  billingMode: z.enum(["monthly", "annual"], {
    message: "Selecciona el tipo de facturacion",
  }),
  country: z.string().trim().min(2, "Selecciona un pais"),
  currency: z.string().trim().length(3, "Selecciona una moneda"),
  timezone: z.string().trim().min(1, "Selecciona una zona horaria"),
});

export const PAYMENT_SCHEMA = z.object({
  paymentMethod: z.enum(["bank_transfer", "qr_payment", "card", "paypal", "other"], {
    message: "Selecciona un método de pago",
  }),
  transactionRef: z
    .string()
    .trim()
    .max(120, "Referencia demasiado larga")
    .optional()
    .or(z.literal("")),
  confirmTransfer: z
    .boolean()
    .refine(
      (value) => value === true,
      "Confirma la transferencia para continuar",
    ),
});

export const ACCEPTED_RECEIPT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;

export const DEFAULT_BANK_DETAILS = {
  bankName: "Banco Nexus Demo",
  accountNumber: "123-456-7890",
  accountHolder: "NexusPOS Technologies",
  amountUsd: 20,
  planName: "Plan Emprende",
  qrPlaceholderUrl: "/og-image.jpg",
} as const;

export const ERROR_MESSAGES = {
  EMAIL_EXISTS: "Ya hay una cuenta registrada con este email.",
  EMAIL_INVALID: "Ingresa un email valido.",
  EMAIL_RATE_LIMIT:
    "Hemos recibido muchas solicitudes para este correo. Intenta nuevamente en unos minutos.",
  GENERIC_AUTH: "No se pudo completar la operacion. Intenta nuevamente.",
  SLUG_TAKEN: "Este nombre no esta disponible.",
  FILE_TOO_LARGE: "El archivo supera el limite permitido.",
  INVALID_FILE_TYPE: "Solo se aceptan PDF, JPG o PNG.",
  UPLOAD_FAILED: "Error al subir el comprobante. Intenta nuevamente.",
  VALIDATION_NOT_FOUND:
    "No se encontro tu validacion de pago. Contacta soporte.",
} as const;

export const PLAN_PRICING = [
  {
    slug: "prueba" as const,
    name: "Prueba",
    priceMonthly: 0,
    description:
      "Experimenta el poder de NexusPOS con nuestra prueba gratuita de 14 dias. Sin tarjeta requerida, sin compromiso.",
    features: ["1 sucursal", "1 usuarios", "Catalogo basico", "Punto de venta"],
    disabledBoth: true,
  },
  {
    slug: "emprende" as const,
    name: "Emprende",
    priceMonthly: 20,
    description:
      "Para negocios que venden un solo tipo: productos O servicios.",
    features: ["1 sucursal", "2 usuarios", "Catalogo basico", "Punto de venta"],
    disabledBoth: true,
  },
  {
    slug: "crecimiento" as const,
    name: "Crecimiento",
    priceMonthly: 50,
    description: "Para negocios que combinan productos y servicios.",
    features: [
      "3 sucursales",
      "5 usuarios",
      "Inventario + Citas",
      "Multi-sucursal",
      "Transferencias",
    ],
  },
  {
    slug: "enterprise" as const,
    name: "Enterprise",
    priceMonthly: 100,
    description: "Todo ilimitado para escalar tu negocio.",
    features: [
      "Sucursales ilimitadas",
      "Usuarios ilimitados",
      "API access",
      "Reportes avanzados",
      "White label",
      "Export forense",
    ],
  },
] as const;

export const getPlanBySlug = (slug: string) =>
  PLAN_PRICING.find((p) => p.slug === slug) ?? null;

export const getPlanAmount = (planSlug: string): number =>
  getPlanBySlug(planSlug)?.priceMonthly ?? PLAN_PRICING[0].priceMonthly;

export const sanitizeText = (value: string | null | undefined): string =>
  value?.trim() ?? "";
export const sanitizeNullableText = (
  value: string | null | undefined,
): string | null => {
  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : null;
};
export const sanitizeEmail = (value: string): string =>
  sanitizeText(value).toLowerCase();
export const slugifyValue = (value: string): string =>
  sanitizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
export const sanitizeFilename = (value: string): string => {
  const extensionMatch = value.toLowerCase().match(/(\.[a-z0-9]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const baseName = value.replace(/(\.[a-z0-9]+)$/i, "");
  const slugBase = slugifyValue(baseName).slice(0, 80) || "archivo";
  return `${slugBase}${extension}`;
};

export const buildReceiptStoragePath = (
  userId: string,
  organizationId: string,
  filename: string,
): string => {
  return `${userId}/${organizationId}/${Date.now()}_${sanitizeFilename(filename)}`;
};

export const buildOrganizationLogoStoragePath = (
  userId: string,
  organizationId: string,
  mimeType: string,
): string => {
  const extension =
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[mimeType] ?? "png";

  return `${userId}/${organizationId}/logo.${extension}`;
};

export const getCountryByCode = (
  countryCode: string | null | undefined,
): CountryOption | null => {
  return COUNTRIES.find((country) => country.code === countryCode) ?? null;
};

export const getCurrencyOptionsForCountry = (
  countryCode: string | null | undefined,
): CurrencyOption[] => {
  const country = getCountryByCode(countryCode);
  if (!country) {
    return [...CURRENCIES];
  }

  const preferred = CURRENCIES.find(
    (currency) => currency.code === country.currency,
  );
  const rest = CURRENCIES.filter(
    (currency) => currency.code !== country.currency,
  );
  return preferred ? [preferred, ...rest] : [...CURRENCIES];
};

export const getTimezoneOptionsForCountry = (
  countryCode: string | null | undefined,
): TimezoneOption[] => {
  const country = getCountryByCode(countryCode);
  if (!country) {
    return [...TIMEZONES];
  }

  const preferred = TIMEZONES.find(
    (timezone) => timezone.value === country.timezone,
  );
  const rest = TIMEZONES.filter(
    (timezone) => timezone.value !== country.timezone,
  );
  return preferred ? [preferred, ...rest] : [...TIMEZONES];
};

export const isReceiptMimeTypeAllowed = (mimeType: string): boolean => {
  return ACCEPTED_RECEIPT_TYPES.includes(mimeType as (typeof ACCEPTED_RECEIPT_TYPES)[number]);
};

export const asJsonObject = (value: Record<string, unknown>): Json =>
  value as Json;
