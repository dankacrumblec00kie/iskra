// Константы, общие для сервера и клиента (без серверных импортов).

export const APP_NAME = "Искра";

export const GENDERS = ["male", "female", "other"] as const;
export const LOOKING_FOR = ["male", "female", "everyone"] as const;
export const GOALS = ["serious", "dating", "friends", "chat"] as const;

export type Gender = (typeof GENDERS)[number];
export type LookingFor = (typeof LOOKING_FOR)[number];
export type Goal = (typeof GOALS)[number];

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Мужчина",
  female: "Женщина",
  other: "Другое",
};

export const LOOKING_FOR_LABEL: Record<LookingFor, string> = {
  male: "Мужчин",
  female: "Женщин",
  everyone: "Всех",
};

export const GOAL_LABEL: Record<Goal, string> = {
  serious: "Серьёзные отношения",
  dating: "Свидания",
  friends: "Дружба",
  chat: "Общение",
};

export const GOAL_EMOJI: Record<Goal, string> = {
  serious: "💍",
  dating: "🥂",
  friends: "🙌",
  chat: "💬",
};

export const LIMITS = {
  minAge: 18,
  maxAge: 99,
  nameMax: 30,
  bioMax: 500,
  jobMax: 60,
  maxPhotos: 6,
  maxInterests: 8,
  maxPhotoBytes: 8 * 1024 * 1024,
  messageMax: 1000,
  maxDistanceKm: 500,
  /** Сколько лайков в сутки доступно без подписки */
  freeLikesPerDay: 30,
  freeSuperlikesPerDay: 1,
  premiumSuperlikesPerDay: 5,
} as const;

export const REPORT_REASONS = [
  { id: "fake", label: "Фейковый профиль" },
  { id: "spam", label: "Спам или реклама" },
  { id: "abuse", label: "Оскорбления или угрозы" },
  { id: "inappropriate", label: "Неприемлемые фото или текст" },
  { id: "underage", label: "Похоже, что младше 18" },
  { id: "other", label: "Другое" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
