import { chromium } from "@playwright/test";

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin.hospedaje@nexuspos.demo";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "Demo123456!";

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

const page = await context.newPage();
const consoleMessages = [];
const requests = [];
const responses = [];
const trackedPaths = [
  "/api/profile",
  "/api/auth/role-permissions",
  "/api/subscription/capabilities",
  "/api/account-status",
];

page.on("console", (message) => {
  consoleMessages.push(`[${message.type()}] ${message.text()}`);
});

page.on("request", (request) => {
  if (request.url().startsWith(APP_URL)) {
    requests.push(`${request.method()} ${request.url()}`);
  }
});

page.on("response", (response) => {
  if (response.url().startsWith(APP_URL)) {
    responses.push(`${response.status()} ${response.url()}`);
  }
});

const buildTrackedCounts = (entries) => {
  return trackedPaths.reduce((counts, path) => {
    counts[path] = entries.filter((entry) => entry.includes(path)).length;
    return counts;
  }, {});
};

try {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1500);

  const formMarkupBefore = await page.locator("form").first().evaluate((node) => node.outerHTML);

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);

  const submitButton = page.getByRole("button", { name: "Iniciar sesion" });
  await submitButton.click();

  await page.waitForTimeout(12000);

  const bodyText = await page.locator("body").innerText();
  const normalizedBody = bodyText.replace(/\s+/g, " ").trim();

  process.stdout.write(`${JSON.stringify({
    startUrl: `${APP_URL}/auth/login`,
    finalUrl: page.url(),
    title: await page.title(),
    bodyIncludes: {
      dashboard: normalizedBody.includes("Dashboard"),
      onboardingPayment: normalizedBody.includes("Pago manual"),
      internalDenied: normalizedBody.includes("Esta cuenta no tiene acceso al panel interno."),
      rubenHotel: normalizedBody.includes("Ruben Hotel"),
      administrador: normalizedBody.includes("Administrador"),
    },
    hydrationReady: await page.evaluate(() => Boolean(window.__NUXT__)),
    formMarkupBefore,
    bodySnippet: normalizedBody.slice(0, 800),
    consoleMessages: consoleMessages.slice(-20),
    requests: requests.slice(-20),
    responses: responses.slice(-20),
    trackedRequestCounts: buildTrackedCounts(requests),
    trackedResponseCounts: buildTrackedCounts(responses),
  }, null, 2)}\n`);
} finally {
  await Promise.race([
    context.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  process.exit(0);
}
