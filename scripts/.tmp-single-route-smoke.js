import fs from "node:fs";
import { chromium } from "@playwright/test";

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "resprogreso@gmail.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "73586901Res";
const ROUTE = process.env.SMOKE_ROUTE ?? "/users";
const OUTPUT_PATH = process.env.SMOKE_OUTPUT_PATH ?? ".tmp-single-route-smoke.json";

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

const page = await context.newPage();
const consoleMessages = [];
const navigations = [];
const requests = [];
const responses = [];
const redirects = [];

page.on("console", (message) => {
  consoleMessages.push(`[${message.type()}] ${message.text()}`);
});

page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) {
    navigations.push(frame.url());
  }
});

page.on("request", (request) => {
  if (request.url().startsWith(APP_URL)) {
    requests.push(`${request.method()} ${request.url()}`);
  }
});

page.on("response", (response) => {
  if (response.url().startsWith(APP_URL)) {
    responses.push(`${response.status()} ${response.url()}`);
    if (response.status() >= 300 && response.status() < 400) {
      redirects.push({
        status: response.status(),
        url: response.url(),
        location: response.headers().location ?? null,
      });
    }
  }
});

const payload = {};

try {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesion" }).click();
  await page.waitForTimeout(30000);

  await page.goto(`${APP_URL}${ROUTE}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  Object.assign(payload, {
    route: ROUTE,
    finalUrl: page.url(),
    bodySnippet: body.slice(0, 600),
    navigations,
    consoleMessages: consoleMessages.slice(-50),
    requests: requests.slice(-80),
    responses: responses.slice(-80),
    redirects,
  });
} catch (error) {
  Object.assign(payload, {
    route: ROUTE,
    error: error instanceof Error ? error.message : String(error),
    finalUrl: page.url(),
    navigations,
    consoleMessages: consoleMessages.slice(-50),
    requests: requests.slice(-80),
    responses: responses.slice(-80),
    redirects,
  });
}

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

await Promise.race([
  context.close(),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]);
await Promise.race([
  browser.close(),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]);
