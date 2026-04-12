export const countriesList = [
  { label: "Argentina", value: "AR" },
  { label: "Bolivia", value: "BO" },
  { label: "Chile", value: "CL" },
  { label: "Colombia", value: "CO" },
  { label: "Espana", value: "ES" },
  { label: "Estados Unidos", value: "US" },
  { label: "Mexico", value: "MX" },
  { label: "Peru", value: "PE" },
  { label: "Uruguay", value: "UY" },
] as const;

export const timezonesList = [
  { label: "America/Lima (Peru)", value: "America/Lima" },
  { label: "America/Mexico_City (Mexico)", value: "America/Mexico_City" },
  { label: "America/Bogota (Colombia)", value: "America/Bogota" },
  {
    label: "America/Argentina/Buenos_Aires (Argentina)",
    value: "America/Argentina/Buenos_Aires",
  },
  { label: "America/Santiago (Chile)", value: "America/Santiago" },
  { label: "America/New_York (EE.UU. Este)", value: "America/New_York" },
  {
    label: "America/Los_Angeles (EE.UU. Oeste)",
    value: "America/Los_Angeles",
  },
  { label: "Europe/Madrid (Espana)", value: "Europe/Madrid" },
  { label: "Europe/London (Reino Unido)", value: "Europe/London" },
  { label: "America/La_Paz (Bolivia)", value: "America/La_Paz" },
] as const;

export const currenciesList = [
  { label: "ARS - Peso Argentino", value: "ARS" },
  { label: "BOB - Boliviano", value: "BOB" },
  { label: "CLP - Peso Chileno", value: "CLP" },
  { label: "COP - Peso Colombiano", value: "COP" },
  { label: "EUR - Euro", value: "EUR" },
  { label: "MXN - Peso Mexicano", value: "MXN" },
  { label: "PEN - Sol Peruano", value: "PEN" },
  { label: "USD - Dolar Estadounidense", value: "USD" },
] as const;

export const countryDefaults: Record<
  string,
  { timezone: string; currency: string }
> = {
  AR: { timezone: "America/Argentina/Buenos_Aires", currency: "ARS" },
  BO: { timezone: "America/La_Paz", currency: "BOB" },
  CL: { timezone: "America/Santiago", currency: "CLP" },
  CO: { timezone: "America/Bogota", currency: "COP" },
  ES: { timezone: "Europe/Madrid", currency: "EUR" },
  MX: { timezone: "America/Mexico_City", currency: "MXN" },
  PE: { timezone: "America/Lima", currency: "PEN" },
  US: { timezone: "America/New_York", currency: "USD" },
};
