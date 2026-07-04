import { chromium } from "@playwright/test";

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "resprogreso@gmail.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "73586901Res";

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

const page = await context.newPage();

const output = {
  loginFinalUrl: null,
  profile: null,
  postAuth: null,
  reportsVisit: null,
};

try {
  await page.goto(`${APP_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesion" }).click();
  await page.waitForTimeout(12000);

  output.loginFinalUrl = page.url();

  output.profile = await page.evaluate(async () => {
    try {
      const response = await fetch("/api/profile", { credentials: "include" });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        body: text,
      };
    } catch (error) {
      return { error: String(error) };
    }
  });

  output.postAuth = await page.evaluate(async () => {
    try {
      const response = await fetch("/api/auth/post-auth-resolution?audience=staff", {
        credentials: "include",
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        body: text,
      };
    } catch (error) {
      return { error: String(error) };
    }
  });

  const reportsResponse = await page.goto(`${APP_URL}/reports`, {
    waitUntil: "domcontentloaded",
  });

  output.reportsVisit = {
    status: reportsResponse?.status() ?? null,
    url: page.url(),
    headers: reportsResponse?.headers() ?? null,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
