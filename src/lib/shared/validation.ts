// Zod-схемы. Одни и те же правила проверяют форму в браузере и запрос на сервере.
import { z } from "zod";
import { GENDERS, GOALS, LIMITS, LOOKING_FOR, REPORT_REASONS } from "./constants";
import { ageFromBirthDate } from "./geo";
import { INTEREST_BY_SLUG } from "./interests";

const email = z
  .string("Введите e-mail")
  .trim()
  .toLowerCase()
  .max(254, "Слишком длинный e-mail")
  .pipe(z.email("Введите корректный e-mail"));

const password = z
  .string("Введите пароль")
  .min(8, "Пароль — минимум 8 символов")
  .max(128, "Пароль — максимум 128 символов");

export const registerSchema = z.object({
  email,
  password,
  acceptTerms: z.literal(true, "Подтвердите, что вам есть 18 лет и вы принимаете правила"),
});

export const loginSchema = z.object({
  email,
  password: z.string("Введите пароль").min(1, "Введите пароль").max(128),
});

const name = z
  .string("Введите имя")
  .trim()
  .min(2, "Имя — минимум 2 символа")
  .max(LIMITS.nameMax, `Имя — максимум ${LIMITS.nameMax} символов`)
  .regex(/^\p{L}[\p{L}\s'-]*$/u, "В имени допустимы только буквы, пробел и дефис");

const birthDate = z.iso
  .date("Укажите дату рождения")
  .refine((d) => ageFromBirthDate(d) >= LIMITS.minAge, "Сервис доступен только с 18 лет")
  .refine((d) => ageFromBirthDate(d) <= LIMITS.maxAge, "Проверьте дату рождения");

const interests = z
  .array(z.string())
  .max(LIMITS.maxInterests, `Можно выбрать до ${LIMITS.maxInterests} интересов`)
  .refine((list) => list.every((slug) => INTEREST_BY_SLUG.has(slug)), "Неизвестный интерес")
  .transform((list) => [...new Set(list)]);

const age = z.number().int().min(LIMITS.minAge).max(LIMITS.maxAge);

const profileFields = {
  name,
  birthDate,
  gender: z.enum(GENDERS, "Выберите пол"),
  lookingFor: z.enum(LOOKING_FOR, "Выберите, кого показывать"),
  goal: z.enum(GOALS, "Выберите цель знакомства"),
  bio: z.string().trim().max(LIMITS.bioMax, `О себе — максимум ${LIMITS.bioMax} символов`),
  job: z.string().trim().max(LIMITS.jobMax, `Максимум ${LIMITS.jobMax} символов`),
  heightCm: z.number().int().min(120, "Рост от 120 см").max(230, "Рост до 230 см").nullable(),
  city: z.string("Выберите город").trim().min(1, "Выберите город").max(80),
  lat: z.number("Выберите город из списка").min(-90).max(90),
  lng: z.number("Выберите город из списка").min(-180).max(180),
  interests,
  ageMin: age,
  ageMax: age,
  maxDistanceKm: z.number().int().min(1).max(LIMITS.maxDistanceKm),
  isVisible: z.boolean(),
};

/** Анкета при первом входе. */
export const onboardingSchema = z.object({
  name: profileFields.name,
  birthDate: profileFields.birthDate,
  gender: profileFields.gender,
  lookingFor: profileFields.lookingFor,
  goal: profileFields.goal,
  bio: profileFields.bio,
  city: profileFields.city,
  lat: profileFields.lat,
  lng: profileFields.lng,
  interests: profileFields.interests,
});

/** Редактирование профиля: любое подмножество полей. Дату рождения менять нельзя. */
export const profilePatchSchema = z
  .object({
    name: profileFields.name,
    gender: profileFields.gender,
    lookingFor: profileFields.lookingFor,
    goal: profileFields.goal,
    bio: profileFields.bio,
    job: profileFields.job,
    heightCm: profileFields.heightCm,
    city: profileFields.city,
    lat: profileFields.lat,
    lng: profileFields.lng,
    interests: profileFields.interests,
    ageMin: profileFields.ageMin,
    ageMax: profileFields.ageMax,
    maxDistanceKm: profileFields.maxDistanceKm,
    isVisible: profileFields.isVisible,
  })
  .partial()
  .refine((v) => v.ageMin === undefined || v.ageMax === undefined || v.ageMin <= v.ageMax, {
    path: ["ageMax"],
    message: "Максимальный возраст не может быть меньше минимального",
  })
  // Город и координаты меняются только вместе, иначе расстояния поедут
  .refine((v) => (v.lat === undefined) === (v.lng === undefined) && (v.lat === undefined) === (v.city === undefined), {
    path: ["city"],
    message: "Выберите город из списка",
  });

export const swipeSchema = z.object({
  toUserId: z.uuid(),
  action: z.enum(["like", "pass", "superlike"]),
});

export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Сообщение пустое")
    .max(LIMITS.messageMax, `Сообщение — максимум ${LIMITS.messageMax} символов`),
});

export const reportSchema = z.object({
  userId: z.uuid(),
  reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]], "Выберите причину"),
  details: z.string().trim().max(1000).default(""),
  block: z.boolean().default(true),
});

export const blockSchema = z.object({ userId: z.uuid() });

export const photoOrderSchema = z.object({
  order: z.array(z.uuid()).min(1).max(LIMITS.maxPhotos),
});

// ── Query-параметры поиска. Приходят строками, поэтому coerce. ──
const queryInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const queryList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")).filter(Boolean));

export const searchFiltersSchema = z.object({
  q: z.string().trim().max(60).optional(),
  ageMin: queryInt(LIMITS.minAge, LIMITS.maxAge).optional(),
  ageMax: queryInt(LIMITS.minAge, LIMITS.maxAge).optional(),
  distance: queryInt(1, LIMITS.maxDistanceKm).optional(),
  goal: z.enum(GOALS).optional(),
  interests: queryList.optional(),
  online: z.enum(["1"]).optional(),
  cursor: z.coerce.number().int().min(0).max(10_000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
