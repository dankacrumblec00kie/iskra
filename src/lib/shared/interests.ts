// Справочник интересов. Единственный источник правды: отсюда он попадает
// и в таблицу interests (scripts/migrate.ts), и в интерфейс.

export type InterestDef = {
  slug: string;
  label: string;
  emoji: string;
  category: string;
};

const catalog: Record<string, [slug: string, label: string, emoji: string][]> = {
  "Спорт и движение": [
    ["gym", "Зал", "🏋️"],
    ["running", "Бег", "🏃"],
    ["yoga", "Йога", "🧘"],
    ["football", "Футбол", "⚽"],
    ["cycling", "Велосипед", "🚴"],
    ["swimming", "Плавание", "🏊"],
    ["snowboard", "Сноуборд", "🏂"],
    ["hiking", "Походы", "🥾"],
    ["dancing", "Танцы", "💃"],
  ],
  "Культура": [
    ["movies", "Кино", "🎬"],
    ["series", "Сериалы", "📺"],
    ["music", "Музыка", "🎧"],
    ["concerts", "Концерты", "🎤"],
    ["theatre", "Театр", "🎭"],
    ["books", "Книги", "📚"],
    ["art", "Искусство", "🎨"],
    ["photo", "Фотография", "📷"],
    ["anime", "Аниме", "🌸"],
  ],
  "Еда и напитки": [
    ["cooking", "Готовка", "🍳"],
    ["coffee", "Кофе", "☕"],
    ["wine", "Вино", "🍷"],
    ["restaurants", "Рестораны", "🍽️"],
    ["baking", "Выпечка", "🥐"],
  ],
  "Образ жизни": [
    ["travel", "Путешествия", "✈️"],
    ["pets", "Животные", "🐾"],
    ["nature", "Природа", "🌲"],
    ["cars", "Автомобили", "🚗"],
    ["fashion", "Мода", "👗"],
    ["volunteering", "Волонтёрство", "🤝"],
    ["meditation", "Медитация", "🪷"],
    ["nightlife", "Ночная жизнь", "🌃"],
  ],
  "Ум и технологии": [
    ["tech", "Технологии", "💻"],
    ["games", "Видеоигры", "🎮"],
    ["boardgames", "Настолки", "🎲"],
    ["startups", "Стартапы", "🚀"],
    ["languages", "Языки", "🗣️"],
    ["science", "Наука", "🔬"],
    ["psychology", "Психология", "🧠"],
    ["podcasts", "Подкасты", "🎙️"],
  ],
};

export const INTERESTS: InterestDef[] = Object.entries(catalog).flatMap(([category, items]) =>
  items.map(([slug, label, emoji]) => ({ slug, label, emoji, category })),
);

export const INTEREST_BY_SLUG = new Map(INTERESTS.map((i) => [i.slug, i]));
export const INTEREST_CATEGORIES = Object.keys(catalog);
