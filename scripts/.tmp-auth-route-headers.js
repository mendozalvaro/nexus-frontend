import fs from "node:fs";
import { chromium } from "@playwright/test";

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "resprogreso@gmail.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "73586901Res";
const OUTPUT_PATH = process.env.SMOKE_OUTPUT_PATH ?? ".tmp-auth-route-headers.json";

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

const page = await context.newPage();

try {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesion" }).click();
  await page.waitForTimeout(12000);

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

  const inspectRoute = async (path) => {
    const response = await fetch(`${APP_URL}${path}`, {
      headers: {
        cookie: cookieHeader,
      },
      redirect: "manual",
    });

    return {
      path,
      status: response.status,
      location: response.headers.get("location"),
    };
  };

  const result = {
    finalBrowserUrl: page.url(),
    routes: await Promise.all([
      inspectRoute("/reports"),
      inspectRoute("/onboarding/organization"),
      inspectRoute("/users"),
    ]),
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await Promise.race([
    context.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
