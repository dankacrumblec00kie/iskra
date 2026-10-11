import { describe, expect, it } from "vitest";
import { ageFromBirthDate, formatDistance, haversineKm, plural, publicDistanceKm } from "@/lib/shared/geo";

describe("haversineKm", () => {
  it("даёт ноль для одной и той же точки", () => {
    expect(haversineKm(55.75, 37.61, 55.75, 37.61)).toBe(0);
  });

  it("считает расстояние Москва — Санкт-Петербург около 634 км", () => {
    const km = haversineKm(55.7558, 37.6173, 59.9343, 30.3351);
    expect(km).toBeGreaterThan(625);
    expect(km).toBeLessThan(640);
  });

  it("симметрична", () => {
    const there = haversineKm(55.7558, 37.6173, 55.7887, 49.1221);
    const back = haversineKm(55.7887, 49.1221, 55.7558, 37.6173);
    expect(there).toBeCloseTo(back, 6);
  });
});

describe("ageFromBirthDate", () => {
  const today = new Date(2026, 9, 11); // 11 октября 2026

  it("не прибавляет год до дня рождения", () => {
    expect(ageFromBirthDate("2008-10-12", today)).toBe(17);
  });

  it("прибавляет год в сам день рождения", () => {
    expect(ageFromBirthDate("2008-10-11", today)).toBe(18);
  });

  it("считает возраст для дня рождения в начале года", () => {
    expect(ageFromBirthDate("1998-01-05", today)).toBe(28);
  });
});

describe("publicDistanceKm", () => {
  it("не раскрывает расстояния меньше километра", () => {
    expect(publicDistanceKm(0)).toBe(1);
    expect(publicDistanceKm(0.3)).toBe(1);
  });

  it("округляет до целых километров", () => {
    expect(publicDistanceKm(7.4)).toBe(7);
    expect(publicDistanceKm(7.6)).toBe(8);
  });

  it("возвращает null, если расстояние неизвестно", () => {
    expect(publicDistanceKm(null)).toBeNull();
    expect(publicDistanceKm(undefined)).toBeNull();
    expect(publicDistanceKm(Number.NaN)).toBeNull();
  });
});

describe("formatDistance", () => {
  it("пишет «рядом» для минимального расстояния", () => {
    expect(formatDistance(1)).toBe("рядом");
  });

  it("добавляет единицы и ничего не пишет без данных", () => {
    expect(formatDistance(12)).toBe("12 км");
    expect(formatDistance(null)).toBe("");
  });
});

describe("plural", () => {
  const forms: [string, string, string] = ["человек", "человека", "человек"];
  const likes: [string, string, string] = ["лайк", "лайка", "лайков"];

  it("выбирает форму по правилам русского языка", () => {
    expect(plural(1, likes)).toBe("лайк");
    expect(plural(3, likes)).toBe("лайка");
    expect(plural(5, likes)).toBe("лайков");
    expect(plural(21, likes)).toBe("лайк");
    expect(plural(22, forms)).toBe("человека");
  });

  it("учитывает исключение 11–14", () => {
    expect(plural(11, likes)).toBe("лайков");
    expect(plural(12, likes)).toBe("лайков");
    expect(plural(114, likes)).toBe("лайков");
  });
});
