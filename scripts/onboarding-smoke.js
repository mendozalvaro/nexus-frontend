import { chromium } from "@playwright/test";

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SMOKE_PHASE = process.env.SMOKE_PHASE ?? "register";
const SMOKE_MODE = process.env.SMOKE_MODE ?? "trial";
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD ?? "Demo123456!";
const SMOKE_FULL_NAME = process.env.SMOKE_FULL_NAME ?? "Smoke User";
const SMOKE_ORG_NAME = process.env.SMOKE_ORG_NAME ?? `Smoke Org ${SMOKE_MODE}`;

if (!SMOKE_EMAIL) {
  throw new Error("SMOKE_EMAIL is required");
}

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

const page = await context.newPage();

const readBody = async () => {
  const bodyText = await page.locator("body").innerText();
  return bodyText.replace(/\s+/g, " ").trim();
};

const waitForAppIdle = async () => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1500);
};

const runRegister = async () => {
  await page.goto(`${APP_URL}/auth/register`, { waitUntil: "domcontentloaded" });
  await waitForAppIdle();

  await page.locator('input[autocomplete="name"]').fill(SMOKE_FULL_NAME);
  await page.locator('input[type="email"]').fill(SMOKE_EMAIL);
  await page.locator('input[autocomplete="new-password"]').fill(SMOKE_PASSWORD);

  const termsCheckbox = page.locator('input[type="checkbox"]');
  if (await termsCheckbox.count()) {
    await termsCheckbox.check({ force: true });
  }

  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForTimeout(4000);

  const body = await readBody();
  return {
    phase: "register",
    finalUrl: page.url(),
    title: await page.title(),
    bodySnippet: body.slice(0, 700),
    verifyEmailScreen: body.includes("verific") || page.url().includes("/auth/verify-email"),
  };
};

const runOnboarding = async () => {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await waitForAppIdle();

  await page.locator('input[type="email"]').fill(SMOKE_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(SMOKE_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesion" }).click();

  await page.waitForTimeout(9000);

  if (!page.url().includes("/onboarding/organization")) {
    const earlyBody = await readBody();
    return {
      phase: "onboarding",
      mode: SMOKE_MODE,
      finalUrl: page.url(),
      title: await page.title(),
      bodySnippet: earlyBody.slice(0, 700),
      reachedOrganization: false,
    };
  }

  await page.locator('input[autofocus]').fill(SMOKE_ORG_NAME);

  if (SMOKE_MODE === "paid") {
    await page.getByRole("button", { name: "Pagar ahora" }).click();
  }

  const submitName = SMOKE_MODE === "paid" ? "Continuar al pago" : "Activar prueba";
  await page.getByRole("button", { name: submitName }).click();
  await page.waitForTimeout(9000);

  const body = await readBody();
  return {
    phase: "onboarding",
    mode: SMOKE_MODE,
    finalUrl: page.url(),
    title: await page.title(),
    bodySnippet: body.slice(0, 900),
    reachedOrganization: true,
    landedOnDashboard: page.url().includes("/dashboard"),
    landedOnPayment: page.url().includes("/onboarding/payment"),
  };
};

try {
  const result = SMOKE_PHASE === "register"
    ? await runRegister()
    : await runOnboarding();

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
