import fs from "node:fs";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const email = process.env.SMOKE_EMAIL ?? "admin.hospedaje@nexuspos.demo";
const password = process.env.SMOKE_PASSWORD ?? "Demo123456!";

const loadEnv = () =>
  Object.fromEntries(
    fs.readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );

const env = loadEnv();
const supabaseUrl = env.NUXT_PUBLIC_SUPABASE_URL;
const supabaseKey = (env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NUXT_PUBLIC_SUPABASE_KEY ?? "").replace(/\s+/g, "");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase public env vars in .env");
}

const login = async () => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(`Unable to authenticate smoke user: ${JSON.stringify(data)}`);
  }

  return data.access_token;
};

const apiFetch = async (token, path, options = {}) => {
  const response = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }

  return body;
};

const summarize = (label, value) => ({ label, value });

const token = await login();

const organization = await apiFetch(token, "/api/organization");
const subscription = await apiFetch(token, "/api/subscription");
const capabilitiesResponse = await apiFetch(token, "/api/subscription/capabilities");
const rooms = await apiFetch(token, "/api/catalog/rooms");
const categories = await apiFetch(token, "/api/catalog/categories?type=lodging");
const reservations = await apiFetch(token, "/api/reservations");
const roomBoard = await apiFetch(token, "/api/reservations/room-board");
const lodgingSummary = await apiFetch(token, "/api/hotel/reports?type=summary");
const lodgingOccupancy = await apiFetch(token, "/api/hotel/reports?type=occupancy");
const dailyControl = await apiFetch(token, "/api/hotel/reports?type=daily-control&date=2026-06-29");

const noopSettingsPayload = {
  name: organization.name,
  country: organization.country,
  currency_code: organization.currency_code,
  timezone: organization.timezone,
  address: organization.address ?? "",
  default_receipt_format: organization.default_receipt_format,
  lodging_checkout_deadline: String(organization.lodging_checkout_deadline ?? "12:00:00").slice(0, 5),
  lodging_stay_cutoff_time: String(organization.lodging_stay_cutoff_time ?? "12:00:00").slice(0, 5),
  lodging_late_checkout_penalty: Number(organization.lodging_late_checkout_penalty ?? 0),
};

await apiFetch(token, "/api/settings/organization", {
  method: "PATCH",
  body: JSON.stringify(noopSettingsPayload),
});

const result = {
  appUrl: APP_URL,
  smokeUser: email,
  checks: [
    summarize("organization", organization.name),
    summarize("subscription_status", subscription.status),
    summarize("plan", subscription.plan?.slug ?? "unknown"),
    summarize("business_types", capabilitiesResponse.capabilities?.businessTypes ?? []),
    summarize("hotel_module", capabilitiesResponse.capabilities?.hasHotelModule ?? false),
    summarize("rooms", Array.isArray(rooms) ? rooms.length : 0),
    summarize("lodging_categories", Array.isArray(categories) ? categories.length : 0),
    summarize("reservations", reservations.total ?? 0),
    summarize("occupied_rooms", Array.isArray(roomBoard) ? roomBoard.filter((room) => room.status === "occupied").length : 0),
    summarize("active_reservations", lodgingSummary.activeReservations ?? 0),
    summarize("occupancy_rate", lodgingOccupancy.occupancyRate ?? 0),
    summarize("daily_control_staying", dailyControl.staying?.length ?? 0),
  ],
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
