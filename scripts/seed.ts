// npm run db:seed — наполняет базу демо-анкетами и двумя тестовыми аккаунтами.
// Скрипт идемпотентен: прошлые демо-данные удаляются и создаются заново.
import "./_env";
import { lorelei } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { inArray, or, eq } from "drizzle-orm";
import sharp from "sharp";
import { db, sql as pg } from "../src/db";
import {
  matches,
  messages,
  notifications,
  photos,
  profileInterests,
  profiles,
  swipes,
  users,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/server/auth/password";
import { processImage } from "../src/lib/server/services/photos";
import { storage } from "../src/lib/server/storage";
import { CITIES, GRADIENTS, HAIR, SEED_PROFILES, type SeedProfile } from "./seed-data";

const DEMO_EMAIL = "demo@iskra.app";
const ADMIN_EMAIL = "admin@iskra.app";

// Детерминированный генератор: один и тот же сид всегда даёт одинаковые анкеты
let state = 20261011;
function random() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];

const W = 810;
const H = 1080;

const variants = (prefix: string, numbers: number[]) =>
  numbers.map((n) => `${prefix}${String(n).padStart(2, "0")}`) as never;

/** Иллюстрированный портрет 3:4 на градиентном фоне. */
async function renderPortrait(options: {
  seed: string;
  hair: number;
  gradient: [string, string];
  beard: boolean;
  glasses: boolean;
  flip: boolean;
  zoom: number;
}) {
  const svg = createAvatar(lorelei, {
    seed: options.seed,
    hair: [`variant${String(options.hair).padStart(2, "0")}`] as never,
    // Варианты отобраны вручную по контактному листу: только приветливые лица,
    // без гримас, подмигиваний и тёмных очков
    mouth: variants("happy", [1, 2, 3, 4, 5, 6, 13, 14, 15]),
    eyes: variants("variant", [2, 4, 5, 6, 7, 9, 10, 11, 12, 14, 16, 20, 21, 23, 24]),
    eyebrows: variants("variant", [1, 2, 4, 5, 6, 7, 9, 10, 11, 12]),
    glasses: variants("variant", [1, 3, 4, 5]),
    beardProbability: options.beard ? 100 : 0,
    glassesProbability: options.glasses ? 100 : 0,
    hairAccessoriesProbability: 0,
    flip: options.flip,
  }).toString();

  const size = Math.round(W * options.zoom);
  const avatar = await sharp(Buffer.from(svg), { density: 400 }).resize(size, size).png().toBuffer();
  const [from, to] = options.gradient;
  const background = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );

  // Портрет центрирован и слегка уходит за нижний край, чтобы плечи «росли» из рамки.
  // sharp не умеет отрицательные смещения, поэтому выступающие части обрезаем заранее.
  const left = Math.round((W - size) / 2);
  const top = Math.round(H - size * 0.9);
  const visible = {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    width: Math.min(size, W - left) - Math.max(0, -left),
    height: Math.min(size, H - top) - Math.max(0, -top),
  };
  const cropped = await sharp(avatar).extract(visible).toBuffer();
  const png = await sharp(background)
    .composite([{ input: cropped, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer();

  return processImage(png);
}

function birthDateFor(age: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  date.setDate(date.getDate() - 20 - Math.floor(random() * 300));
  return date.toISOString().slice(0, 10);
}

async function createAccount(input: {
  email: string;
  password?: string;
  role?: "user" | "admin";
  isDemo: boolean;
  premiumDays?: number;
  alwaysOnline?: boolean;
  profile: SeedProfile;
  index: number;
}) {
  const { profile, index } = input;
  const [lat, lng] = CITIES[profile.city];
  // Разброс в пределах города, чтобы расстояния в демо были разными
  const spread = profile.city === "Москва" ? 0.11 : 0.04;
  const farFuture = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000);
  const hoursAgo = new Date(Date.now() - Math.floor(random() * 72) * 3600 * 1000);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      role: input.role ?? "user",
      isDemo: input.isDemo,
      acceptedTermsAt: new Date(),
      premiumUntil: input.premiumDays ? new Date(Date.now() + input.premiumDays * 86400_000) : null,
      // У части демо-анкет «в сети» включено навсегда — лента на защите выглядит живой
      lastSeenAt: input.alwaysOnline ? farFuture : hoursAgo,
    })
    .returning({ id: users.id });

  await db.insert(profiles).values({
    userId: user.id,
    name: profile.name,
    birthDate: birthDateFor(profile.age),
    gender: profile.gender,
    lookingFor: profile.lookingFor,
    goal: profile.goal,
    bio: profile.bio,
    job: profile.job,
    heightCm: profile.heightCm,
    city: profile.city,
    lat: Math.round((lat + (random() - 0.5) * spread) * 100) / 100,
    lng: Math.round((lng + (random() - 0.5) * spread * 1.6) * 100) / 100,
    ageMin: 18,
    ageMax: 60,
    maxDistanceKm: 500,
    onboardedAt: new Date(),
  });

  await db
    .insert(profileInterests)
    .values(profile.interests.map((interestSlug) => ({ userId: user.id, interestSlug })));

  const hair = pick(HAIR[profile.gender]);
  const beard = profile.gender === "male" && random() < 0.3;
  const glasses = random() < 0.22;
  const first = Math.floor(random() * GRADIENTS.length);
  const shots = [
    { gradient: GRADIENTS[first], flip: false, zoom: 1.3 },
    { gradient: GRADIENTS[(first + 5) % GRADIENTS.length], flip: true, zoom: 1.75 },
  ];

  for (const [position, shot] of shots.entries()) {
    const image = await renderPortrait({ seed: `iskra-${index}`, hair, beard, glasses, ...shot });
    const storageKey = `photos/${user.id}/seed-${position}.webp`;
    const { url } = await storage.put(storageKey, image.data, "image/webp");
    await db.insert(photos).values({
      userId: user.id,
      url,
      storageKey,
      width: image.width,
      height: image.height,
      blurDataUrl: image.blurDataUrl,
      position,
    });
  }

  return user.id;
}

async function cleanup() {
  const old = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.isDemo, true), inArray(users.email, [DEMO_EMAIL, ADMIN_EMAIL])));
  if (old.length === 0) return;

  const ids = old.map((u) => u.id);
  const files = await db
    .select({ storageKey: photos.storageKey })
    .from(photos)
    .where(inArray(photos.userId, ids));
  await Promise.all(files.map((f) => storage.remove(f.storageKey).catch(() => {})));
  await db.delete(users).where(inArray(users.id, ids));
}

async function main() {
  await cleanup();

  const idByName = new Map<string, string>();
  for (const [index, profile] of SEED_PROFILES.entries()) {
    const id = await createAccount({
      email: `seed-${index + 1}@demo.iskra.local`,
      isDemo: true,
      alwaysOnline: index % 3 === 0,
      profile,
      index,
    });
    idByName.set(profile.name, id);
    process.stdout.write(`\r[seed] анкеты: ${index + 1}/${SEED_PROFILES.length}`);
  }
  process.stdout.write("\n");

  const demoId = await createAccount({
    email: DEMO_EMAIL,
    password: "demo1234",
    isDemo: false,
    index: 1001,
    profile: {
      name: "Алекс",
      age: 27,
      gender: "male",
      lookingFor: "everyone",
      city: "Москва",
      goal: "dating",
      heightCm: 181,
      job: "Продуктовый дизайнер",
      bio: "Демо-аккаунт для знакомства с приложением. Люблю кофе, длинные прогулки и хорошие интерфейсы.",
      interests: ["coffee", "travel", "tech", "music", "art", "movies"],
    },
  });

  await createAccount({
    email: ADMIN_EMAIL,
    password: "admin1234",
    role: "admin",
    isDemo: false,
    premiumDays: 365,
    index: 1002,
    profile: {
      name: "Вера",
      age: 30,
      gender: "female",
      lookingFor: "everyone",
      city: "Москва",
      goal: "friends",
      heightCm: 170,
      job: "Модератор сервиса",
      bio: "Аккаунт администратора: подписка активна, открыт раздел модерации.",
      interests: ["books", "psychology", "yoga", "coffee"],
    },
  });

  const id = (name: string) => {
    const value = idByName.get(name);
    if (!value) throw new Error(`Нет демо-анкеты «${name}»`);
    return value;
  };

  // Входящие симпатии демо-аккаунта: раздел «Лайки» сразу не пустой
  const incoming: [string, "like" | "superlike"][] = [
    ["Аня", "superlike"],
    ["Марк", "like"],
    ["Кира", "like"],
    ["Лиза", "like"],
    ["Денис", "superlike"],
    ["Полина", "like"],
    ["Варя", "like"],
  ];
  await db
    .insert(swipes)
    .values(incoming.map(([name, action]) => ({ fromUserId: id(name), toUserId: demoId, action })));

  // Готовые пары с историей переписки
  const chats: [string, [mine: boolean, body: string][]][] = [
    [
      "Мария",
      [
        [false, "Привет! Увидела, что ты тоже любишь длинные прогулки 🙂"],
        [true, "Привет! Да, особенно по набережным. А ты где обычно бегаешь?"],
        [false, "Чаще всего в Парке Горького, по утрам там почти никого"],
        [false, "Кстати, в субботу обещают солнце. Составишь компанию?"],
      ],
    ],
    [
      "Антон",
      [
        [true, "Какой последний фильм тебя по-настоящему зацепил?"],
        [false, "«Аноним» — там монтаж сам по себе как отдельный персонаж"],
        [true, "Записал. Посмотрю и вернусь с вопросами"],
      ],
    ],
    ["Стас", []],
  ];

  for (const [index, [name, thread]] of chats.entries()) {
    const otherId = id(name);
    await db.insert(swipes).values([
      { fromUserId: demoId, toUserId: otherId, action: "like" },
      { fromUserId: otherId, toUserId: demoId, action: "like" },
    ]);
    const [a, b] = demoId < otherId ? [demoId, otherId] : [otherId, demoId];
    const start = Date.now() - (index + 1) * 5 * 3600 * 1000;
    const [match] = await db
      .insert(matches)
      .values({
        userAId: a,
        userBId: b,
        createdAt: new Date(start),
        lastMessageAt: thread.length ? new Date(start + thread.length * 240_000) : null,
      })
      .returning({ id: matches.id });

    if (thread.length) {
      await db.insert(messages).values(
        thread.map(([mine, body], i) => {
          const createdAt = new Date(start + (i + 1) * 240_000);
          return {
            matchId: match.id,
            senderId: mine ? demoId : otherId,
            body,
            createdAt,
            // Последнее входящее сообщение оставляем непрочитанным — виден бейдж
            readAt: !mine && i === thread.length - 1 ? null : createdAt,
          };
        }),
      );
    }
    await db.insert(notifications).values({
      userId: demoId,
      type: "match",
      payload: { matchId: match.id, userId: otherId, name },
      createdAt: new Date(start),
    });
  }

  console.log(`[seed] готово: ${SEED_PROFILES.length} демо-анкет`);
  console.log(`[seed] вход: ${DEMO_EMAIL} / demo1234   администратор: ${ADMIN_EMAIL} / admin1234`);
}

try {
  await main();
} finally {
  await pg.end();
}
