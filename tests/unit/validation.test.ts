import { describe, expect, it } from "vitest";
import {
  loginSchema,
  messageSchema,
  onboardingSchema,
  profilePatchSchema,
  registerSchema,
  searchFiltersSchema,
  swipeSchema,
} from "@/lib/shared/validation";

/** Дата рождения человека, которому сегодня исполнилось ровно `years` лет (плюс сдвиг в днях). */
function birthDate(years: number, shiftDays = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + shiftDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const validOnboarding = {
  name: "Анна-Мария",
  birthDate: birthDate(25),
  gender: "female",
  lookingFor: "everyone",
  goal: "dating",
  bio: "",
  city: "Москва",
  lat: 55.75,
  lng: 37.61,
  interests: ["coffee", "travel"],
};

describe("registerSchema", () => {
  it("приводит e-mail к нижнему регистру и убирает пробелы", () => {
    const result = registerSchema.parse({ email: "  User@Example.COM ", password: "12345678", acceptTerms: true });
    expect(result.email).toBe("user@example.com");
  });

  it("требует согласия с правилами", () => {
    expect(registerSchema.safeParse({ email: "a@b.ru", password: "12345678", acceptTerms: false }).success).toBe(false);
  });

  it("отклоняет короткий пароль с понятным сообщением", () => {
    const result = registerSchema.safeParse({ email: "a@b.ru", password: "1234567", acceptTerms: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Пароль — минимум 8 символов");
  });

  it("отклоняет некорректный e-mail", () => {
    expect(registerSchema.safeParse({ email: "not-an-email", password: "12345678", acceptTerms: true }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("не навязывает минимальную длину пароля при входе", () => {
    expect(loginSchema.safeParse({ email: "a@b.ru", password: "x" }).success).toBe(true);
  });
});

describe("onboardingSchema", () => {
  it("принимает корректную анкету", () => {
    expect(onboardingSchema.safeParse(validOnboarding).success).toBe(true);
  });

  it("не пускает тех, кому до 18 остался один день", () => {
    const result = onboardingSchema.safeParse({ ...validOnboarding, birthDate: birthDate(18, 1) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Сервис доступен только с 18 лет");
  });

  it("пускает в день восемнадцатилетия", () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, birthDate: birthDate(18) }).success).toBe(true);
  });

  it("отклоняет имя с цифрами и разметкой", () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, name: "Аня123" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validOnboarding, name: "<b>Аня</b>" }).success).toBe(false);
  });

  it("отклоняет неизвестные интересы и убирает повторы", () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, interests: ["hacking"] }).success).toBe(false);
    const result = onboardingSchema.parse({ ...validOnboarding, interests: ["coffee", "coffee", "tech"] });
    expect(result.interests).toEqual(["coffee", "tech"]);
  });

  it("ограничивает число интересов", () => {
    const many = ["gym", "running", "yoga", "football", "cycling", "swimming", "hiking", "dancing", "movies"];
    expect(onboardingSchema.safeParse({ ...validOnboarding, interests: many }).success).toBe(false);
  });

  it("принимает только значения пола из списка", () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, gender: "robot" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validOnboarding, lookingFor: "other" }).success).toBe(false);
  });
});

describe("profilePatchSchema", () => {
  it("принимает частичное обновление", () => {
    expect(profilePatchSchema.safeParse({ bio: "Новый текст" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({}).success).toBe(true);
  });

  it("не даёт сохранить перевёрнутый диапазон возраста", () => {
    expect(profilePatchSchema.safeParse({ ageMin: 40, ageMax: 25 }).success).toBe(false);
  });

  it("не даёт искать младше 18", () => {
    expect(profilePatchSchema.safeParse({ ageMin: 16, ageMax: 25 }).success).toBe(false);
  });

  it("требует город и координаты только вместе", () => {
    expect(profilePatchSchema.safeParse({ city: "Казань" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ lat: 55.78, lng: 49.12 }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ city: "Казань", lat: 55.78, lng: 49.12 }).success).toBe(true);
  });

  it("не позволяет менять дату рождения", () => {
    const result = profilePatchSchema.parse({ birthDate: "1990-01-01", bio: "текст" } as never);
    expect(result).not.toHaveProperty("birthDate");
  });
});

describe("swipeSchema и messageSchema", () => {
  it("требует UUID и известное действие", () => {
    expect(swipeSchema.safeParse({ toUserId: "42", action: "like" }).success).toBe(false);
    expect(
      swipeSchema.safeParse({ toUserId: "3f2c1a9e-8b7d-4c6f-9e1a-2b3c4d5e6f70", action: "hug" }).success,
    ).toBe(false);
    expect(
      swipeSchema.safeParse({ toUserId: "3f2c1a9e-8b7d-4c6f-9e1a-2b3c4d5e6f70", action: "superlike" }).success,
    ).toBe(true);
  });

  it("обрезает пробелы и отклоняет пустое сообщение", () => {
    expect(messageSchema.parse({ body: "  привет  " }).body).toBe("привет");
    expect(messageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ body: "я".repeat(1001) }).success).toBe(false);
  });
});

describe("searchFiltersSchema", () => {
  it("приводит строки из query к числам", () => {
    const result = searchFiltersSchema.parse({ ageMin: "25", ageMax: "30", distance: "50", cursor: "24" });
    expect(result).toMatchObject({ ageMin: 25, ageMax: 30, distance: 50, cursor: 24 });
  });

  it("разбирает интересы и из строки через запятую, и из массива", () => {
    expect(searchFiltersSchema.parse({ interests: "coffee,tech" }).interests).toEqual(["coffee", "tech"]);
    expect(searchFiltersSchema.parse({ interests: ["coffee", "tech"] }).interests).toEqual(["coffee", "tech"]);
  });

  it("отклоняет значения вне допустимых границ", () => {
    expect(searchFiltersSchema.safeParse({ ageMin: "5" }).success).toBe(false);
    expect(searchFiltersSchema.safeParse({ distance: "100000" }).success).toBe(false);
    expect(searchFiltersSchema.safeParse({ goal: "marriage" }).success).toBe(false);
  });
});
