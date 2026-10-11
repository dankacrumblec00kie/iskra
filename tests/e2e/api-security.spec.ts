import { expect, test, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

// Проверки правил доступа на уровне API: то, что нельзя сделать через интерфейс,
// не должно получаться и прямым запросом.

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

test.describe("доступ без входа", () => {
  for (const path of ["/api/me", "/api/discover", "/api/nearby", "/api/likes", "/api/matches", "/api/admin/stats"]) {
    test(`${path} отвечает 401`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(401);
      expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    });
  }

  test("закрытая страница перенаправляет на вход", async ({ page }) => {
    await page.goto("/matches");
    await page.waitForURL("**/login?next=%2Fmatches");
  });
});

test("перебор пароля упирается в ограничение частоты", async ({ request, baseURL }) => {
  const email = `e2e-bruteforce-${Date.now()}@test.local`;
  const attempt = () =>
    request.post("/api/auth/login", { data: { email, password: "guess-12345" }, headers: { origin: baseURL! } });

  for (let i = 0; i < 10; i++) expect((await attempt()).status()).toBe(401);
  const blocked = await attempt();
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
});

test.describe("правила для вошедшего пользователя", () => {
  // Один вход на весь набор: частые входы сами упёрлись бы в ограничение из теста выше.
  // Заголовок Origin, как у браузера, подставляется во все запросы.
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright, baseURL }) => {
    api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
    const response = await api.post("/api/auth/login", {
      data: { email: "demo@iskra.app", password: "demo1234" },
    });
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("нельзя лайкнуть анкету, которой мой пол не подходит", async () => {
    // Демо-аккаунт — мужчина. Берём из базы мужчину, который ищет только женщин:
    // в ленте его нет, id можно узнать лишь в обход интерфейса.
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const [target] = await sql`
      select p.user_id as id from profiles p join users u on u.id = p.user_id
      where u.is_demo and p.gender = 'male' and p.looking_for = 'female' limit 1`;
    await sql.end();

    const response = await api.post("/api/swipes", { data: { toUserId: target.id, action: "like" } });
    expect(response.status()).toBe(404);
  });

  test("чужой чат и чужой платёж не видны", async () => {
    expect((await api.get(`/api/matches/${MISSING_ID}/messages`)).status()).toBe(404);
    expect((await api.get(`/api/billing/payments/${MISSING_ID}`)).status()).toBe(404);
  });

  test("некорректный id в адресе — это 404, а не ошибка сервера", async () => {
    expect((await api.get("/api/users/not-a-uuid")).status()).toBe(404);
    expect((await api.get("/api/users/1%27%20or%201=1--")).status()).toBe(404);
  });

  test("раздел модерации закрыт для обычного пользователя", async () => {
    expect((await api.get("/api/admin/stats")).status()).toBe(403);
    expect((await api.get("/api/admin/reports")).status()).toBe(403);
    const response = await api.post(`/api/admin/reports/${MISSING_ID}`, { data: { action: "ban" } });
    expect(response.status()).toBe(403);
  });

  test("изменяющий запрос с чужого сайта отклоняется", async () => {
    const response = await api.post("/api/auth/logout", { headers: { origin: "https://evil.example" } });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("BAD_ORIGIN");
    // Сессия при этом осталась жива
    expect((await api.get("/api/me")).status()).toBe(200);
  });

  test("цену нельзя подменить: сумма берётся из каталога на сервере", async () => {
    const checkout = await api.post("/api/billing/checkout", {
      data: { productId: "premium_12m", amountMinor: 1, priceMinor: 1 },
    });
    expect(checkout.ok()).toBe(true);
    const { paymentId } = await checkout.json();

    const payment = await (await api.get(`/api/billing/payments/${paymentId}`)).json();
    expect(payment.amountMinor).toBe(299_000);

    await api.delete(`/api/billing/payments/${paymentId}`);
  });

  test("в ответах API нет координат и e-mail других людей", async () => {
    const { cards } = await (await api.get("/api/nearby")).json();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card).not.toHaveProperty("lat");
      expect(card).not.toHaveProperty("lng");
      expect(card).not.toHaveProperty("email");
      expect(card).not.toHaveProperty("birthDate");
      if (card.distanceKm !== null) expect(Number.isInteger(card.distanceKm)).toBe(true);
    }
  });

  test("без подписки список лайков не раскрывает анкеты", async () => {
    const likes = await (await api.get("/api/likes")).json();
    expect(likes.unlocked).toBe(false);
    expect(likes.cards).toEqual([]);
    for (const teaser of likes.teasers) {
      expect(Object.keys(teaser).sort()).toEqual(["blur", "superlike"]);
      expect(teaser.blur.startsWith("data:image/webp;base64,")).toBe(true);
    }
  });

  test("отмена свайпа доступна только с подпиской", async () => {
    expect((await api.delete("/api/swipes")).status()).toBe(402);
  });

  test("вместо картинки нельзя загрузить произвольный файл", async () => {
    const response = await api.post("/api/me/photos", {
      multipart: {
        file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") },
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_IMAGE");
  });

  test("файлы вне папки загрузок не отдаются", async () => {
    expect((await api.get("/api/files/..%2F..%2Fpackage.json")).status()).toBe(404);
    expect((await api.get("/api/files/photos/../../.env.local")).status()).toBe(404);
  });
});
