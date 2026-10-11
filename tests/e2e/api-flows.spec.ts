import { expect, test, type APIRequestContext, type PlaywrightWorkerArgs } from "@playwright/test";
import sharp from "sharp";

// Сценарии с двумя настоящими (не демо) пользователями на уровне API:
// взаимная симпатия, переписка, скрытие анкеты, покупки, жалоба с блокировкой, модерация, удаление аккаунта.

type Client = { api: APIRequestContext; id: string; email: string; tag: string };

const PASSWORD = "flows-password-123";
const stamp = Date.now();

async function createUser(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  input: { key: string; name: string; gender: "male" | "female"; color: string },
): Promise<Client> {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const email = `e2e-${input.key}-${stamp}@test.local`;
  // Уникальная метка в тексте анкеты — по ней пользователя находит поиск
  const tag = `метка${input.key}${stamp}`;

  expect((await api.post("/api/auth/register", { data: { email, password: PASSWORD, acceptTerms: true } })).ok()).toBe(true);

  const photo = await sharp({ create: { width: 800, height: 1000, channels: 3, background: input.color } }).jpeg().toBuffer();
  const upload = await api.post("/api/me/photos", {
    multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: photo } },
  });
  expect(upload.ok()).toBe(true);

  const onboarding = await api.post("/api/me/onboarding", {
    data: {
      name: input.name,
      birthDate: "1997-03-15",
      gender: input.gender,
      lookingFor: "everyone",
      goal: "dating",
      bio: `Тестовая анкета ${tag}`,
      city: "Москва",
      lat: 55.7558,
      lng: 37.6173,
      interests: ["coffee", "tech"],
    },
  });
  expect(onboarding.ok()).toBe(true);
  const me = await onboarding.json();
  expect(me.onboarded).toBe(true);
  return { api, id: me.id, email, tag };
}

const findInNearby = async (who: Client, target: Client) => {
  const { cards } = await (await who.api.get(`/api/nearby?q=${encodeURIComponent(target.tag)}`)).json();
  return (cards as { id: string }[]).find((card) => card.id === target.id);
};

test.describe("поиск и фильтры", () => {
  type Card = { id: string; age: number; goal: string; interests: string[]; distanceKm: number | null; online: boolean };
  let api: APIRequestContext;
  const nearby = async (query: string) =>
    (await (await api.get(`/api/nearby${query}`)).json()) as { cards: Card[]; nextCursor: number | null };

  test.beforeAll(async ({ playwright, baseURL }) => {
    api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
    expect((await api.post("/api/auth/login", { data: { email: "demo@iskra.app", password: "demo1234" } })).ok()).toBe(true);
  });
  test.afterAll(async () => {
    await api.dispose();
  });

  test("фильтры по возрасту, цели и интересу применяются на сервере", async () => {
    const byAge = await nearby("?ageMin=25&ageMax=30");
    expect(byAge.cards.length).toBeGreaterThan(0);
    expect(byAge.cards.every((c) => c.age >= 25 && c.age <= 30)).toBe(true);

    const byGoal = await nearby("?goal=serious");
    expect(byGoal.cards.length).toBeGreaterThan(0);
    expect(byGoal.cards.every((c) => c.goal === "serious")).toBe(true);

    const byInterest = await nearby("?interests=snowboard,yoga");
    expect(byInterest.cards.length).toBeGreaterThan(0);
    expect(byInterest.cards.every((c) => c.interests.includes("snowboard") || c.interests.includes("yoga"))).toBe(true);

    const online = await nearby("?online=1");
    expect(online.cards.every((c) => c.online)).toBe(true);
  });

  test("ограничение расстояния отсекает другие города, список идёт от ближних к дальним", async () => {
    const near = await nearby("?distance=50");
    expect(near.cards.length).toBeGreaterThan(0);
    expect(near.cards.every((c) => c.distanceKm !== null && c.distanceKm <= 50)).toBe(true);

    const distances = near.cards.map((c) => c.distanceKm!);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test("поиск находит по профессии, интересу и городу без учёта регистра", async () => {
    expect((await nearby(`?q=${encodeURIComponent("ДИЗАЙНЕР")}`)).cards.length).toBeGreaterThan(0);
    expect((await nearby(`?q=${encodeURIComponent("кофе")}`)).cards.length).toBeGreaterThan(0);
    expect((await nearby(`?q=${encodeURIComponent("казань")}`)).cards.length).toBeGreaterThan(0);
    expect((await nearby(`?q=${encodeURIComponent("такогословатамнет")}`)).cards).toEqual([]);
    // Спецсимволы LIKE ищутся буквально, а не как «любая строка»
    expect((await nearby("?q=%25")).cards).toEqual([]);
  });

  test("страницы не пересекаются", async () => {
    const first = await nearby("");
    expect(first.nextCursor).not.toBeNull();
    const second = await nearby(`?cursor=${first.nextCursor}`);
    const ids = new Set(first.cards.map((c) => c.id));
    expect(second.cards.length).toBeGreaterThan(0);
    expect(second.cards.some((c) => ids.has(c.id))).toBe(false);
  });
});

test.describe.serial("два пользователя", () => {
  let alice: Client;
  let boris: Client;
  let matchId: string;

  test.beforeAll(async ({ playwright, baseURL }) => {
    alice = await createUser(playwright, baseURL!, { key: "alice", name: "Алиса", gender: "female", color: "#c96aa0" });
    boris = await createUser(playwright, baseURL!, { key: "boris", name: "Борис", gender: "male", color: "#5a7fd0" });
  });

  test.afterAll(async () => {
    await alice.api.dispose();
    await boris.api.dispose();
  });

  test("фото при загрузке сжимается в WebP и получает размытое превью", async () => {
    const me = await (await alice.api.get("/api/me")).json();
    expect(me.photos).toHaveLength(1);
    expect(me.photos[0].url).toMatch(/\.webp$/);
    expect(me.photos[0].blur).toMatch(/^data:image\/webp;base64,/);
    // Диапазон возраста по умолчанию — вокруг собственного
    expect(me.profile.ageMin).toBeLessThan(me.profile.age);
    expect(me.profile.ageMax).toBeGreaterThan(me.profile.age);
  });

  test("анкету нельзя заполнить второй раз", async () => {
    const again = await alice.api.post("/api/me/onboarding", {
      data: {
        name: "Другая",
        birthDate: "1990-01-01",
        gender: "male",
        lookingFor: "female",
        goal: "chat",
        bio: "",
        city: "Казань",
        lat: 55.78,
        lng: 49.12,
        interests: [],
      },
    });
    expect(again.status()).toBe(403);
  });

  test("пользователи находят друг друга через поиск", async () => {
    const found = await findInNearby(alice, boris);
    expect(found).toMatchObject({ id: boris.id, name: "Борис", age: expect.any(Number), myAction: null, matchId: null });
    expect(await findInNearby(boris, alice)).toBeTruthy();
  });

  test("лайк в одну сторону — ещё не пара; ответный лайк создаёт её", async () => {
    const first = await (await alice.api.post("/api/swipes", { data: { toUserId: boris.id, action: "like" } })).json();
    expect(first.match).toBeNull();
    expect(first.limits.likesLeft).toBe(29);

    // Повтор того же свайпа ничего не меняет и не тратит лимит
    const repeat = await (await alice.api.post("/api/swipes", { data: { toUserId: boris.id, action: "like" } })).json();
    expect(repeat.limits.likesLeft).toBe(29);

    const second = await (await boris.api.post("/api/swipes", { data: { toUserId: alice.id, action: "like" } })).json();
    expect(second.match).toMatchObject({ user: { id: alice.id, name: "Алиса" } });
    matchId = second.match.id;

    for (const client of [alice, boris]) {
      const { matches } = await (await client.api.get("/api/matches")).json();
      expect(matches.map((m: { id: string }) => m.id)).toContain(matchId);
    }
  });

  test("пара порождает уведомление, чтение гасит счётчик", async () => {
    const { notifications } = await (await alice.api.get("/api/notifications")).json();
    expect(notifications).toContainEqual(expect.objectContaining({ type: "match", read: false }));

    expect((await (await alice.api.get("/api/me/counters")).json()).unreadNotifications).toBeGreaterThan(0);
    await alice.api.post("/api/notifications");
    expect((await (await alice.api.get("/api/me/counters")).json()).unreadNotifications).toBe(0);
  });

  test("сообщение доходит, после открытия чата помечается прочитанным", async () => {
    const sent = await (await alice.api.post(`/api/matches/${matchId}/messages`, { data: { body: "Привет, Борис!" } })).json();
    expect(sent).toMatchObject({ body: "Привет, Борис!", mine: true, readAt: null });

    expect((await (await boris.api.get("/api/me/counters")).json()).unreadMessages).toBe(1);

    const borisView = await (await boris.api.get(`/api/matches/${matchId}/messages`)).json();
    expect(borisView.messages).toHaveLength(1);
    expect(borisView.messages[0]).toMatchObject({ id: sent.id, mine: false });
    expect((await (await boris.api.get("/api/me/counters")).json()).unreadMessages).toBe(0);

    const aliceView = await (await alice.api.get(`/api/matches/${matchId}/messages`)).json();
    expect(aliceView.messages[0].readAt).not.toBeNull();

    // Опрос «только новые»: после последнего сообщения ничего нет
    const after = encodeURIComponent(new Date(Date.now() + 1000).toISOString());
    const fresh = await (await boris.api.get(`/api/matches/${matchId}/messages?after=${after}`)).json();
    expect(fresh.messages).toHaveLength(0);
  });

  test("скрытая анкета пропадает из поиска и возвращается обратно", async () => {
    await boris.api.patch("/api/me", { data: { isVisible: false } });
    expect(await findInNearby(alice, boris)).toBeUndefined();
    // Паре анкета по-прежнему доступна по прямой ссылке
    expect((await alice.api.get(`/api/users/${boris.id}`)).status()).toBe(200);

    await boris.api.patch("/api/me", { data: { isVisible: true } });
    expect(await findInNearby(alice, boris)).toBeTruthy();
  });

  test("буст выставляет срок, повторное подтверждение платежа его не удваивает", async () => {
    const { paymentId } = await (await boris.api.post("/api/billing/checkout", { data: { productId: "boost_30" } })).json();
    await boris.api.post(`/api/billing/payments/${paymentId}`);
    const until = new Date((await (await boris.api.get("/api/me")).json()).profile.boostedUntil).getTime();
    const minutes = (until - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(28);
    expect(minutes).toBeLessThan(31);

    await boris.api.post(`/api/billing/payments/${paymentId}`);
    const again = new Date((await (await boris.api.get("/api/me")).json()).profile.boostedUntil).getTime();
    expect(again).toBe(until);
  });

  test("Premium открывает возврат анкеты; состоявшуюся пару вернуть нельзя", async () => {
    // Последний свайп Алисы — лайк Борису, ставший парой
    const { paymentId } = await (await alice.api.post("/api/billing/checkout", { data: { productId: "premium_1m" } })).json();
    await alice.api.post(`/api/billing/payments/${paymentId}`);
    const me = await (await alice.api.get("/api/me")).json();
    expect(me.isPremium).toBe(true);
    expect(me.limits.likesLeft).toBeNull();

    expect((await alice.api.delete("/api/swipes")).status()).toBe(409);

    const { cards } = await (await alice.api.get("/api/discover")).json();
    const skipped = cards[0];
    await alice.api.post("/api/swipes", { data: { toUserId: skipped.id, action: "pass" } });
    const afterPass = await (await alice.api.get("/api/discover")).json();
    expect(afterPass.cards.map((c: { id: string }) => c.id)).not.toContain(skipped.id);

    const rewind = await (await alice.api.delete("/api/swipes")).json();
    expect(rewind.card.id).toBe(skipped.id);
    const afterRewind = await (await alice.api.get("/api/discover")).json();
    expect(afterRewind.cards.map((c: { id: string }) => c.id)).toContain(skipped.id);
  });

  test("подписчик видит входящие лайки целиком", async () => {
    const likes = await (await alice.api.get("/api/likes")).json();
    expect(likes.unlocked).toBe(true);
    expect(likes.teasers).toEqual([]);
    expect(likes.cards.length).toBe(likes.count);
  });

  test("жалоба блокирует: пара и чат исчезают, жалоба попадает модератору, бан завершает сессии", async ({
    playwright,
    baseURL,
  }) => {
    const report = await alice.api.post("/api/reports", {
      data: { userId: boris.id, reason: "spam", details: "Автотест: проверка жалобы", block: true },
    });
    expect(report.ok()).toBe(true);

    const { matches } = await (await alice.api.get("/api/matches")).json();
    expect(matches.map((m: { id: string }) => m.id)).not.toContain(matchId);
    expect((await boris.api.get(`/api/matches/${matchId}/messages`)).status()).toBe(404);
    expect((await boris.api.post(`/api/matches/${matchId}/messages`, { data: { body: "Эй" } })).status()).toBe(404);
    expect(await findInNearby(alice, boris)).toBeUndefined();
    expect(await findInNearby(boris, alice)).toBeUndefined();
    expect((await boris.api.get(`/api/users/${alice.id}`)).status()).toBe(404);

    const blocked = await (await alice.api.get("/api/blocks")).json();
    expect(blocked.blocked.map((u: { id: string }) => u.id)).toContain(boris.id);

    // Модератор видит жалобу и блокирует нарушителя
    const admin = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
    expect((await admin.post("/api/auth/login", { data: { email: "admin@iskra.app", password: "admin1234" } })).ok()).toBe(true);
    const queue = await (await admin.get("/api/admin/reports")).json();
    const item = queue.reports.find((r: { reported: { id: string } }) => r.reported.id === boris.id);
    expect(item).toMatchObject({ reason: "Спам или реклама", details: "Автотест: проверка жалобы" });

    const stats = await (await admin.get("/api/admin/stats")).json();
    expect(stats.openReports).toBeGreaterThan(0);

    expect((await admin.post(`/api/admin/reports/${item.id}`, { data: { action: "ban" } })).ok()).toBe(true);
    await admin.dispose();

    // Сессия Бориса завершена; после нового входа аккаунт отвечает «заблокирован»
    expect((await boris.api.get("/api/me")).status()).toBe(401);
    await boris.api.post("/api/auth/login", { data: { email: boris.email, password: PASSWORD } });
    const banned = await boris.api.get("/api/me");
    expect(banned.status()).toBe(403);
    expect((await banned.json()).error.code).toBe("BANNED");
  });

  test("удаление аккаунта стирает данные и закрывает вход", async () => {
    const photoUrl = (await (await alice.api.get("/api/me")).json()).photos[0].url;
    expect((await alice.api.get(photoUrl)).status()).toBe(200);

    expect((await alice.api.delete("/api/me")).ok()).toBe(true);
    expect((await alice.api.get("/api/me")).status()).toBe(401);
    expect((await alice.api.get(photoUrl)).status()).toBe(404);

    const login = await alice.api.post("/api/auth/login", { data: { email: alice.email, password: PASSWORD } });
    expect(login.status()).toBe(401);
  });
});
