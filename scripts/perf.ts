// npm run perf — замер скорости загрузки ключевых страниц в настоящем браузере.
// Запускать против production-сборки: `npm run build && npm run start`, затем `npm run perf`.
// Эмулируется телефон среднего класса: 4-кратное замедление процессора и сеть «быстрый 4G».
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = [
  { name: "Главная", path: "/", auth: false },
  { name: "Вход", path: "/login", auth: false },
  { name: "Лента", path: "/discover", auth: true },
  { name: "Рядом", path: "/nearby", auth: true },
  { name: "Чаты", path: "/matches", auth: true },
];

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const rows: Record<string, string | number>[] = [];

for (const target of PAGES) {
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "ru-RU" });
  if (target.auth) {
    await context.request.post(`${BASE}/api/auth/login`, {
      data: { email: "demo@iskra.app", password: "demo1234" },
      headers: { origin: BASE },
    });
  }
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  // LCP и сдвиги макета собираем наблюдателем с самого начала загрузки
  await page.addInitScript(() => {
    const store = { lcp: 0, cls: 0 };
    (window as unknown as { __perf: typeof store }).__perf = store;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) store.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(BASE + target.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const perf = (window as unknown as { __perf: { lcp: number; cls: number } }).__perf;
    // Без вспомогательных функций: сборщик tsx добавляет к ним служебный код, которого нет в браузере
    return {
      ttfb: nav.responseStart,
      dcl: nav.domContentLoadedEventEnd,
      lcp: perf.lcp,
      cls: perf.cls,
      js: resources.filter((r) => r.name.includes(".js")).reduce((total, r) => total + r.transferSize, 0),
      total: resources.reduce((total, r) => total + r.transferSize, nav.transferSize),
      requests: resources.length + 1,
    };
  });

  rows.push({
    Страница: target.name,
    "TTFB, мс": Math.round(metrics.ttfb),
    "DOMContentLoaded, мс": Math.round(metrics.dcl),
    "LCP, мс": Math.round(metrics.lcp),
    CLS: metrics.cls.toFixed(3),
    "JS, КБ": Math.round(metrics.js / 1024),
    "Всего, КБ": Math.round(metrics.total / 1024),
    Запросов: metrics.requests,
  });
  await context.close();
}

await browser.close();
console.table(rows);
