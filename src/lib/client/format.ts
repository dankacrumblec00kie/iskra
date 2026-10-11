// Форматирование дат для интерфейса. Вызывается только в браузере, после загрузки данных.

const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

/** «Сегодня», «Вчера» или «12 октября» — заголовок группы сообщений. */
export function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return dayFormat.format(date);
}

/** Короткая отметка для списка чатов: время сегодня, иначе дата. */
export function formatListTime(iso: string) {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return timeFormat.format(date);
  if (diffDays === 1) return "вчера";
  return shortDayFormat.format(date);
}

export function formatDate(iso: string) {
  return dayFormat.format(new Date(iso));
}

export const isSameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));
