import type { Product } from "./types";

// Тарифы. Цены — в копейках. Меняются здесь, сервер берёт сумму только отсюда:
// клиент присылает лишь id товара, поэтому подменить цену в запросе нельзя.
export const PRODUCTS: Product[] = [
  {
    id: "premium_1m",
    kind: "premium",
    title: "1 месяц",
    description: "Попробовать все возможности",
    priceMinor: 49_900,
    amount: 30,
  },
  {
    id: "premium_3m",
    kind: "premium",
    title: "3 месяца",
    description: "397 ₽ в месяц",
    priceMinor: 119_000,
    amount: 90,
    badge: "Популярный",
  },
  {
    id: "premium_12m",
    kind: "premium",
    title: "12 месяцев",
    description: "249 ₽ в месяц",
    priceMinor: 299_000,
    amount: 365,
    badge: "Выгода 50%",
  },
  {
    id: "boost_30",
    kind: "boost",
    title: "Буст на 30 минут",
    description: "Ваша анкета — первой в ленте у людей рядом",
    priceMinor: 9_900,
    amount: 30,
  },
];

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export const PREMIUM_FEATURES = [
  { emoji: "💛", title: "Кто вас лайкнул", text: "Открытый список симпатий — мэтч в один тап" },
  { emoji: "♾️", title: "Безлимитные лайки", text: "Никаких суточных ограничений" },
  { emoji: "⭐", title: "5 суперлайков в день", text: "Вас увидят первыми и с отметкой" },
  { emoji: "↩️", title: "Возврат анкеты", text: "Случайно смахнули — верните назад" },
] as const;

export function formatPrice(minor: number) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}
