import { COUNTRIES, getCountryByCode, getCurrencyOptionsForCountry, getTimezoneOptionsForCountry } from "@/utils/onboarding";

export interface GeoIPResult {
  country: string;
  countryName: string;
  currency: string;
  timezone: string;
}

const FALLBACK: GeoIPResult = {
  country: "BO",
  countryName: "Bolivia",
  currency: "BOB",
  timezone: "America/La_Paz",
};

const GEOIP_APIS = [
  { url: "https://ipapi.co/json/", parse: parseIpApiCo },
  { url: "https://ip-api.com/json/", parse: parseIpApiCom },
];

function parseIpApiCo(data: any): GeoIPResult | null {
  if (!data?.country_code) return null;
  const country = getCountryByCode(data.country_code);
  return country
    ? { country: country.code, countryName: country.label, currency: country.currency, timezone: country.timezone }
    : null;
}

function parseIpApiCom(data: any): GeoIPResult | null {
  if (!data?.countryCode) return null;
  const country = getCountryByCode(data.countryCode);
  return country
    ? { country: country.code, countryName: country.label, currency: country.currency, timezone: country.timezone }
    : null;
}

export const useGeoIP = () => {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const detectCountry = async (): Promise<GeoIPResult> => {
    loading.value = true;
    error.value = null;

    for (const api of GEOIP_APIS) {
      try {
        const res = await fetch(api.url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const data = await res.json();
        const result = api.parse(data);
        if (result) {
          loading.value = false;
          return result;
        }
      } catch {
        continue;
      }
    }

    loading.value = false;
    error.value = "No se pudo detectar tu pais. Usando Bolivia por defecto.";
    return FALLBACK;
  };

  const getCurrencyForCountry = (countryCode: string) => {
    const country = getCountryByCode(countryCode);
    return country?.currency ?? "USD";
  };

  const getTimezoneForCountry = (countryCode: string) => {
    const country = getCountryByCode(countryCode);
    return country?.timezone ?? "UTC";
  };

  return {
    loading,
    error,
    detectCountry,
    getCurrencyForCountry,
    getTimezoneForCountry,
    countries: COUNTRIES,
    getCurrencyOptionsForCountry,
    getTimezoneOptionsForCountry,
  };
};
