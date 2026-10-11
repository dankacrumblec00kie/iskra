import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { HttpError } from "@/lib/server/errors";
import { resolveUploadPath, UPLOADS_DIR } from "@/lib/server/storage";
import { orderedPair } from "@/lib/shared/pairs";
import { formatPrice, PRODUCT_BY_ID, PRODUCTS } from "@/lib/shared/products";

describe("хэширование паролей", () => {
  it("подтверждает верный пароль и отклоняет неверный", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", hash)).toBe(false);
  });

  it("даёт разные хэши одному паролю (случайная соль)", async () => {
    const [a, b] = await Promise.all([hashPassword("одинаковый"), hashPassword("одинаковый")]);
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
  });

  it("не хранит пароль в открытом виде", async () => {
    expect(await hashPassword("super-secret")).not.toContain("super-secret");
  });

  it("не падает на мусоре вместо хэша", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$10$abc")).toBe(false);
  });
});

describe("resolveUploadPath", () => {
  it("разрешает пути внутри папки загрузок", () => {
    expect(resolveUploadPath("photos/user/file.webp")).toBe(path.join(UPLOADS_DIR, "photos", "user", "file.webp"));
  });

  it("отклоняет попытки выйти из папки загрузок", () => {
    expect(resolveUploadPath("../.env.local")).toBeNull();
    expect(resolveUploadPath("photos/../../package.json")).toBeNull();
    expect(resolveUploadPath("..\\..\\secret")).toBeNull();
    expect(resolveUploadPath("")).toBeNull();
  });
});

describe("orderedPair", () => {
  it("возвращает одну и ту же пару независимо от порядка аргументов", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    expect(orderedPair(a, b)).toEqual([a, b]);
    expect(orderedPair(b, a)).toEqual([a, b]);
  });
});

describe("каталог тарифов", () => {
  it("содержит только положительные цены в копейках", () => {
    for (const product of PRODUCTS) {
      expect(Number.isInteger(product.priceMinor)).toBe(true);
      expect(product.priceMinor).toBeGreaterThan(0);
      expect(product.amount).toBeGreaterThan(0);
    }
  });

  it("делает длинную подписку выгоднее в пересчёте на день", () => {
    const perDay = (id: string) => {
      const product = PRODUCT_BY_ID.get(id)!;
      return product.priceMinor / product.amount;
    };
    expect(perDay("premium_3m")).toBeLessThan(perDay("premium_1m"));
    expect(perDay("premium_12m")).toBeLessThan(perDay("premium_3m"));
  });

  it("форматирует цену в рублях", () => {
    expect(formatPrice(49_900).replace(/\s/g, " ")).toBe("499 ₽");
    expect(formatPrice(119_000).replace(/\s/g, " ")).toBe("1 190 ₽");
  });
});

describe("HttpError", () => {
  it("несёт статус, код и ошибки по полям", () => {
    const error = new HttpError(422, "VALIDATION", "Проверьте поля", { email: "Некорректный e-mail" });
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({ email: "Некорректный e-mail" });
  });
});
