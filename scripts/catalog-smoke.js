import { chromium } from "@playwright/test";
import fs from "node:fs";

const DEMO_USERS = {
  product: "admin.producto@nexuspos.demo",
  service: "admin.servicios@nexuspos.demo",
  lodging: "admin.hospedaje@nexuspos.demo",
  multi: "admin.multi@nexuspos.demo",
};

const DEMO_PASSWORD = "Demo123456!";
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const TARGET = process.argv[2] ?? "all";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const supabaseUrl = env.NUXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NUXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, "");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars in .env");
}

const selectedUsers = TARGET === "all"
  ? Object.entries(DEMO_USERS)
  : [[TARGET, DEMO_USERS[TARGET]]].filter((entry) => Boolean(entry[1]));

if (selectedUsers.length === 0) {
  throw new Error(`Unknown target "${TARGET}". Use one of: ${Object.keys(DEMO_USERS).join(", ")}, all`);
}

const getCookieValue = async (email) => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${email}: ${JSON.stringify(data)}`);
  }

  return `base64-${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
};

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
});

try {
  const results = [];

  for (const [key, email] of selectedUsers) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const cookieValue = await getCookieValue(email);
    const screenshotPath = `.tmp-catalog-smoke-${key}.png`;

    await context.addCookies([{
      name: "nexuspos-auth",
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    }]);

    await page.goto(`${APP_URL}/catalogo`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(10000);

    const bodyText = await page.locator("body").innerText();
    const tabs = [
      "Resumen",
      "Productos",
      "Categorias Productos",
      "Servicios",
      "Categorias Servicios",
      "Habitaciones",
      "Categorias Habitaciones",
    ].filter((label) => bodyText.includes(label));

    await page.screenshot({ path: screenshotPath, fullPage: true });

    results.push({
      user: key,
      email,
      url: page.url(),
      tabs,
      screenshotPath,
    });

    await context.close();
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}
