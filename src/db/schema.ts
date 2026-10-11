import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────────────────────── Enums ───────────────────────────── */

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const lookingForEnum = pgEnum("looking_for", ["male", "female", "everyone"]);
export const goalEnum = pgEnum("goal", ["serious", "dating", "friends", "chat"]);
export const swipeActionEnum = pgEnum("swipe_action", ["like", "pass", "superlike"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "canceled",
]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────────────────── Users & sessions ───────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    // null для аккаунтов, созданных через OAuth
    passwordHash: text("password_hash"),
    googleId: text("google_id"),
    role: userRoleEnum("role").notNull().default("user"),
    premiumUntil: timestamp("premium_until", { withTimezone: true }),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
    // Демо-анкеты из сида. В режиме DEMO_MODE они отвечают взаимностью, чтобы
    // на защите проекта можно было показать мэтч и чат без второго человека.
    isDemo: boolean("is_demo").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("users_google_id_uq").on(t.googleId),
    index("users_last_seen_idx").on(t.lastSeenAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // В БД лежит только SHA-256 от токена: утечка таблицы не даёт войти в аккаунт
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

/* ───────────────────────────── Profiles ───────────────────────────── */

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    birthDate: date("birth_date").notNull(),
    gender: genderEnum("gender").notNull(),
    lookingFor: lookingForEnum("looking_for").notNull(),
    goal: goalEnum("goal").notNull().default("dating"),
    bio: text("bio").notNull().default(""),
    job: text("job").notNull().default(""),
    heightCm: smallint("height_cm"),

    city: text("city").notNull().default(""),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),

    // Настройки поиска
    ageMin: smallint("age_min").notNull().default(18),
    ageMax: smallint("age_max").notNull().default(45),
    maxDistanceKm: smallint("max_distance_km").notNull().default(100),

    isVisible: boolean("is_visible").notNull().default(true),
    boostedUntil: timestamp("boosted_until", { withTimezone: true }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    index("profiles_discover_idx").on(t.gender, t.lookingFor, t.isVisible),
    index("profiles_birth_date_idx").on(t.birthDate),
    index("profiles_geo_idx").on(t.lat, t.lng),
    check("profiles_age_range_ck", sql`${t.ageMin} >= 18 and ${t.ageMax} >= ${t.ageMin}`),
    // Сервис строго 18+: гарантия на уровне БД, а не только в форме
    check(
      "profiles_adult_ck",
      sql`${t.birthDate} <= (current_date - interval '18 years')`,
    ),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    storageKey: text("storage_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    // Крошечное размытое превью (data URL): плейсхолдер при загрузке и тизер в «Лайках» без подписки
    blurDataUrl: text("blur_data_url").notNull().default(""),
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("photos_user_idx").on(t.userId, t.position)],
);

export const interests = pgTable("interests", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  emoji: text("emoji").notNull(),
  category: text("category").notNull(),
  position: smallint("position").notNull().default(0),
});

export const profileInterests = pgTable(
  "profile_interests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    interestSlug: text("interest_slug")
      .notNull()
      .references(() => interests.slug, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.interestSlug] }),
    index("profile_interests_slug_idx").on(t.interestSlug),
  ],
);

/* ─────────────────────── Swipes, matches, chat ─────────────────────── */

export const swipes = pgTable(
  "swipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: swipeActionEnum("action").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("swipes_pair_uq").on(t.fromUserId, t.toUserId),
    index("swipes_to_idx").on(t.toUserId, t.action),
    index("swipes_from_created_idx").on(t.fromUserId, t.createdAt),
    check("swipes_not_self_ck", sql`${t.fromUserId} <> ${t.toUserId}`),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Пара хранится упорядоченно (a < b), поэтому один мэтч на пару гарантирует уникальный индекс
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("matches_pair_uq").on(t.userAId, t.userBId),
    index("matches_b_idx").on(t.userBId),
    check("matches_ordered_ck", sql`${t.userAId} < ${t.userBId}`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_match_created_idx").on(t.matchId, t.createdAt)],
);

/* ───────────────────────────── Safety ───────────────────────────── */

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_idx").on(t.blockedId),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedId: uuid("reported_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

/* ─────────────────────── Billing & notifications ─────────────────────── */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id"),
    productId: text("product_id").notNull(),
    // Сумма в копейках: деньги не храним в float
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("RUB"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("payments_provider_id_uq").on(t.provider, t.providerPaymentId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

// Счётчики для ограничения частоты запросов (логин, регистрация, сообщения).
// Хранятся в БД, потому что на serverless память процесса не общая между инстансами.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/* ───────────────────────────── Relations ───────────────────────────── */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  photos: many(photos),
  sessions: many(sessions),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  interests: many(profileInterests),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  user: one(users, { fields: [photos.userId], references: [users.id] }),
}));

export const profileInterestsRelations = relations(profileInterests, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileInterests.userId],
    references: [profiles.userId],
  }),
  interest: one(interests, {
    fields: [profileInterests.interestSlug],
    references: [interests.slug],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  match: one(matches, { fields: [messages.matchId], references: [matches.id] }),
}));

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Gender = (typeof genderEnum.enumValues)[number];
export type LookingFor = (typeof lookingForEnum.enumValues)[number];
export type Goal = (typeof goalEnum.enumValues)[number];
export type SwipeAction = (typeof swipeActionEnum.enumValues)[number];
