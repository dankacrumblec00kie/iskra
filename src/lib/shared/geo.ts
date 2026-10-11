// Чистые функции без зависимостей: используются и на сервере, и на клиенте, и в тестах.

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Расстояние между двумя точками по формуле гаверсинусов, км. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Полных лет на дату `now`. `birthDate` — строка YYYY-MM-DD. */
export function ageFromBirthDate(birthDate: string, now = new Date()) {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = now.getFullYear() - y;
  const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * Расстояние для показа другому пользователю. Точные координаты наружу не отдаём:
 * округляем, а всё, что ближе километра, показываем как «1 км» — так нельзя
 * вычислить адрес человека серией замеров.
 */
export function publicDistanceKm(km: number | null | undefined) {
  if (km === null || km === undefined || Number.isNaN(km)) return null;
  return Math.max(1, Math.round(km));
}

export function formatDistance(km: number | null) {
  if (km === null) return "";
  if (km <= 1) return "рядом";
  return `${km} км`;
}

/** Склонение: plural(5, ['год', 'года', 'лет']) → 'лет' */
export function plural(n: number, forms: [one: string, few: string, many: string]) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
