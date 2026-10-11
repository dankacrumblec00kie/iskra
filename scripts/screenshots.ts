// npm run screenshots — снимает экраны приложения для README и ручной проверки вёрстки.
// Нужен запущенный сервер (npm run dev) и демо-данные (npm run db:seed).
// Браузер по умолчанию — установленный в системе Edge; BROWSER_CHANNEL=chrome переключит на Chrome.
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "docs/screenshots");
const ONLY = process.argv[3]?.split(",");

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;

type Account = "guest" | "demo" | "admin";
type Shot = { name: string; path: string; as: Account; prepare?: (page: Page) => Promise<void> };

const CREDENTIALS = {
  demo: { email: "demo@iskra.app", password: "demo1234" },
  admin: { email: "admin@iskra.app", password: "admin1234" },
} as const;

const SHOTS: Shot[] = [
  { name: "landing", path: "/", as: "guest" },
  { name: "login", path: "/login", as: "guest" },
  { name: "discover", path: "/discover", as: "demo" },
  {
    name: "profile-sheet",
    path: "/discover",
    as: "demo",
    prepare: async (page) => {
      await page.getByRole("button", { name: /Открыть анкету/ }).first().click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "filters",
    path: "/discover",
    as: "demo",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Фильтры" }).click();
      await page.waitForTimeout(400);
    },
  },
  { name: "nearby", path: "/nearby", as: "demo" },
  { name: "likes", path: "/likes", as: "demo" },
  { name: "matches", path: "/matches", as: "demo" },
  {
    name: "chat",
    path: "/matches",
    as: "demo",
    prepare: async (page) => {
      await page.getByRole("link", { name: /Мария/ }).first().click();
      await page.waitForURL(/\/chat\//);
      await page.getByRole("log").waitFor({ timeout: 15_000 });
      await page.waitForTimeout(400);
    },
  },
  { name: "profile", path: "/profile", as: "demo" },
  { name: "profile-edit", path: "/profile/edit", as: "demo" },
  { name: "premium", path: "/premium", as: "demo" },
  { name: "settings", path: "/settings", as: "demo" },
  { name: "notifications", path: "/notifications", as: "demo" },
  {
    name: "checkout",
    path: "/premium",
    as: "demo",
    prepare: async (page) => {
      await page.getByRole("button", { name: /Оформить за/ }).click();
      await page.waitForURL(/\/premium\/checkout\//);
      await page.getByRole("button", { name: /^Оплатить/ }).waitFor();
    },
  },
  // Последним: лайк создаёт пару и меняет данные демо-аккаунта
  {
    name: "match",
    path: "/discover",
    as: "demo",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Нравится", exact: true }).click();
      await page.getByRole("dialog", { name: "Взаимная симпатия" }).waitFor();
      await page.waitForTimeout(700);
    },
  },
  { name: "admin", path: "/admin", as: "admin" },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const problems: string[] = [];

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  for (const account of ["guest", "demo", "admin"] as const) {
    const context = await browser.newContext({ ...viewport, locale: "ru-RU", reducedMotion: "reduce" });
    if (account !== "guest") {
      const response = await context.request.post(`${BASE}/api/auth/login`, {
        data: CREDENTIALS[account],
        headers: { origin: BASE },
      });
      if (!response.ok()) {
        throw new Error(`Не удалось войти (${account}): ${response.status()}. Выполните npm run db:seed`);
      }
    }

    for (const shot of SHOTS.filter((s) => s.as === account && (!ONLY || ONLY.includes(s.name)))) {
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`[${device}/${shot.name}] console: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`[${device}/${shot.name}] pageerror: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 500) problems.push(`[${device}/${shot.name}] ${response.status()} ${response.url()}`);
      });

      await page.goto(BASE + shot.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await shot.prepare?.(page);
      await page.screenshot({ path: path.join(OUT, `${shot.name}-${device}.png`) });
      await page.close();
      console.log(`✓ ${shot.name}-${device}`);
    }
    await context.close();
  }
}

await browser.close();
if (problems.length) {
  console.log("\nПроблемы в браузере:");
  for (const problem of [...new Set(problems)]) console.log("  " + problem);
  process.exitCode = 1;
}
