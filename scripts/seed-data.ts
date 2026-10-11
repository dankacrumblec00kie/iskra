// Демо-анкеты для сида. Все персонажи вымышлены, портреты — сгенерированные иллюстрации.
import type { Gender, Goal, LookingFor } from "../src/lib/shared/constants";

export type SeedProfile = {
  name: string;
  age: number;
  gender: Gender;
  lookingFor: LookingFor;
  city: keyof typeof CITIES;
  goal: Goal;
  job: string;
  bio: string;
  interests: string[];
  heightCm: number;
};

export const CITIES = {
  Москва: [55.7558, 37.6173],
  Химки: [55.897, 37.4297],
  Мытищи: [55.9116, 37.7308],
  Балашиха: [55.7963, 37.9382],
  "Санкт-Петербург": [59.9343, 30.3351],
  Казань: [55.7887, 49.1221],
  Екатеринбург: [56.8389, 60.6057],
  Новосибирск: [55.0084, 82.9357],
} as const;

type Row = [
  name: string,
  age: number,
  gender: Gender,
  lookingFor: LookingFor,
  city: keyof typeof CITIES,
  goal: Goal,
  heightCm: number,
  job: string,
  interests: string,
  bio: string,
];

const rows: Row[] = [
  // ── Женщины ──
  ["Аня", 24, "female", "male", "Москва", "dating", 167, "UX-дизайнер", "art,coffee,travel,yoga,photo", "Рисую интерфейсы днём и акварель по выходным. Ищу того, с кем можно молчать в музее и спорить о кино после."],
  ["Мария", 27, "female", "male", "Москва", "serious", 170, "Врач-терапевт", "books,running,cooking,theatre", "После смены спасаюсь пробежкой по набережной. Готовлю лучший в районе том-ям, проверено соседями."],
  ["Даша", 22, "female", "male", "Москва", "chat", 163, "Студентка журфака", "music,concerts,series,coffee,podcasts", "Знаю все кофейни внутри Садового. Пишу диплом о подкастах и слушаю их слишком много."],
  ["Екатерина", 31, "female", "male", "Химки", "serious", 172, "Финансовый аналитик", "travel,wine,hiking,languages", "23 страны, испанский и итальянский. Следующая цель — Патагония. Нужен попутчик с рюкзаком и чувством юмора."],
  ["Полина", 26, "female", "male", "Москва", "dating", 165, "Бариста и обжарщик", "coffee,cycling,music,baking,pets", "Могу час рассказывать про кенийскую арабику. Дома ждёт корги по имени Гречка."],
  ["Софья", 29, "female", "male", "Санкт-Петербург", "serious", 168, "Архитектор", "art,photo,theatre,books,wine", "Проектирую дома, в которых хочется жить. Люблю парадные, крыши и долгие разговоры на кухне."],
  ["Алина", 23, "female", "male", "Казань", "dating", 160, "SMM-менеджер", "dancing,fashion,nightlife,travel", "Танцую бачату три раза в неделю. Научу, даже если у тебя две левые ноги."],
  ["Вика", 28, "female", "male", "Москва", "friends", 174, "Тренер по плаванию", "swimming,gym,nature,pets,cooking", "Мастер спорта, но на свидании могу и проиграть в настольный хоккей. Иногда."],
  ["Лера", 25, "female", "male", "Мытищи", "dating", 166, "Frontend-разработчик", "tech,games,boardgames,anime,coffee", "Пишу на TypeScript, играю в «Каркассон» на вылет. Если знаешь, что такое flexbox, — уже плюс."],
  ["Ксения", 33, "female", "male", "Москва", "serious", 171, "Юрист", "books,wine,restaurants,theatre,psychology", "Днём договоры, вечером Чехов. Ценю точность в словах и вовремя забронированный столик."],
  ["Настя", 21, "female", "male", "Екатеринбург", "chat", 162, "Студентка, будущий биолог", "science,nature,hiking,pets,books", "Могу отличить 14 видов мхов. Не спрашивай зачем — просто пойдём в лес."],
  ["Ольга", 35, "female", "male", "Москва", "serious", 169, "Руководитель проектов", "travel,yoga,cooking,startups,meditation", "Запускаю продукты и пеку хлеб на закваске. И то и другое требует терпения."],
  ["Яна", 26, "female", "male", "Балашиха", "dating", 164, "Фотограф", "photo,travel,movies,nature,cars", "Снимаю людей так, что они себе нравятся. На свидание приду с плёночной камерой."],
  ["Ева", 24, "female", "male", "Новосибирск", "dating", 168, "Аналитик данных", "tech,snowboard,science,games", "Зимой — Шерегеш, летом — Алтай, между ними — SQL. Ищу напарника на склон."],
  ["Тоня", 27, "female", "female", "Москва", "serious", 166, "Иллюстратор", "art,books,pets,coffee,anime", "Рисую детские книги и держу двух кошек. Идеальный вечер — плед, чай и хорошая история."],
  ["Рита", 30, "female", "female", "Москва", "dating", 173, "Шеф-кондитер", "baking,restaurants,travel,wine,music", "Делаю десерты, ради которых бронируют столик за месяц. Дома готовлю обычные сырники."],
  ["Саша", 25, "female", "female", "Санкт-Петербург", "dating", 165, "Музыкант", "music,concerts,nightlife,art,podcasts", "Играю на басу в инди-группе. Покажу бары, которых нет на картах."],
  ["Женя", 28, "female", "female", "Москва", "friends", 170, "Продакт-менеджер", "startups,running,tech,psychology,hiking", "Бегаю полумарафоны и строю гипотезы. В отношениях A/B-тесты не провожу, честно."],
  ["Мила", 23, "female", "female", "Химки", "chat", 161, "Флорист", "nature,art,yoga,baking,pets", "Собираю букеты и знаю язык цветов. Тебе подарю что-нибудь колючее и красивое."],
  ["Кира", 26, "female", "everyone", "Москва", "dating", 167, "Диджей", "music,nightlife,concerts,fashion,travel", "Свожу хаус по пятницам. Днём сплю, вечером оживаю — предупреждаю сразу."],
  ["Лиза", 29, "female", "everyone", "Москва", "friends", 164, "Психолог", "psychology,books,meditation,yoga,theatre", "Обещаю не анализировать тебя на первом свидании. На втором — посмотрим."],
  ["Арина", 22, "female", "everyone", "Казань", "chat", 169, "Гейм-дизайнер", "games,anime,tech,boardgames,art", "Придумываю уровни для мобильных игр. Прошла Elden Ring без призывов, горжусь."],
  ["Варя", 32, "female", "everyone", "Санкт-Петербург", "serious", 172, "Сомелье", "wine,restaurants,travel,languages,cooking", "Подберу вино к любому разговору. Французский, грузинский и немного здравого смысла."],

  // ── Мужчины ──
  ["Максим", 28, "male", "female", "Москва", "serious", 183, "Backend-разработчик", "tech,gym,boardgames,travel,coffee", "Пишу на Go, готовлю пасту как итальянская бабушка. Ищу ту, с кем не скучно молчать."],
  ["Дима", 25, "male", "female", "Москва", "dating", 178, "Видеограф", "movies,photo,cycling,music,travel", "Снимаю клипы и свадьбы. Знаю, где в Москве самый красивый закат, — покажу."],
  ["Артём", 31, "male", "female", "Химки", "serious", 186, "Инженер-строитель", "football,cars,hiking,cooking,nature", "Строю мосты в прямом смысле. По выходным — футбол и шашлык за городом."],
  ["Никита", 23, "male", "female", "Москва", "chat", 180, "Студент-медик", "science,gym,series,podcasts,running", "Шестой курс, почти не сплю. Зато знаю, как правильно делать искусственное дыхание."],
  ["Кирилл", 29, "male", "female", "Санкт-Петербург", "dating", 182, "Бармен", "nightlife,music,wine,restaurants,travel", "Сделаю коктейль под твоё настроение. Собираю винил и истории гостей."],
  ["Илья", 34, "male", "female", "Москва", "serious", 179, "Предприниматель", "startups,running,books,travel,meditation", "Две компании, один марафон и ни одного свободного вторника. Работаю над балансом."],
  ["Тимур", 27, "male", "female", "Казань", "dating", 177, "Шеф-повар", "cooking,restaurants,football,travel,wine", "Готовлю татарскую кухню с французским акцентом. Эчпочмак на первом свидании — да."],
  ["Егор", 26, "male", "female", "Мытищи", "friends", 184, "Тренер по сноуборду", "snowboard,hiking,nature,gym,photo", "Зимой живу на горе, летом — в палатке. В городе бываю проездом, лови момент."],
  ["Роман", 30, "male", "female", "Москва", "serious", 181, "Аналитик в банке", "books,theatre,wine,languages,psychology", "Читаю по книге в неделю. Хожу в театр чаще, чем в бар, и не стесняюсь этого."],
  ["Ваня", 22, "male", "female", "Екатеринбург", "chat", 175, "Музыкант", "music,concerts,games,anime,coffee", "Гитара, синтезатор и слишком много педалей. Напишу тебе песню, если повезёт."],
  ["Глеб", 33, "male", "female", "Новосибирск", "serious", 188, "Хирург", "science,swimming,cooking,nature,books", "Руки не дрожат даже после двух эспрессо. Плаваю в Оби до октября."],
  ["Лёша", 24, "male", "female", "Балашиха", "dating", 176, "Автомеханик", "cars,football,gym,movies,pets", "Чиню то, что другие списывают. Дома — овчарка и коллекция масштабных моделей."],
  ["Марк", 27, "male", "male", "Москва", "serious", 180, "Архитектор", "art,travel,photo,wine,theatre", "Влюблён в конструктивизм и хорошие линии. По воскресеньям — рынок и долгий завтрак."],
  ["Денис", 30, "male", "male", "Москва", "dating", 185, "Фитнес-тренер", "gym,running,cooking,nature,pets", "Составлю программу тренировок и меню. Чит-мил по субботам — святое."],
  ["Стас", 25, "male", "male", "Санкт-Петербург", "dating", 178, "Графический дизайнер", "art,music,nightlife,fashion,coffee", "Делаю афиши для клубов. Знаю все выставки месяца и где после них поесть."],
  ["Олег", 34, "male", "male", "Москва", "serious", 182, "Врач-кардиолог", "books,travel,wine,swimming,theatre", "Слушаю сердца профессионально. Своё берегу для кого-то особенного."],
  ["Паша", 23, "male", "male", "Химки", "chat", 176, "Стример", "games,anime,tech,series,podcasts", "Стримлю инди-игры для трёхсот добрых людей. Могу болтать о лоре часами."],
  ["Тёма", 28, "male", "male", "Казань", "friends", 181, "Маркетолог", "startups,travel,dancing,restaurants,languages", "Запускаю рекламу, танцую сальсу, учу португальский. Всё сразу и немного хаотично."],
  ["Антон", 29, "male", "everyone", "Москва", "dating", 183, "Режиссёр монтажа", "movies,series,music,photo,coffee", "Смотрю кино покадрово. Могу испортить любой фильм комментариями — или сделать лучше."],
  ["Миша", 26, "male", "everyone", "Москва", "friends", 179, "Преподаватель йоги", "yoga,meditation,nature,travel,cooking", "Жил полгода в ашраме, вернулся с рецептом идеального чая. Дышу глубоко, говорю мало."],
  ["Юра", 32, "male", "everyone", "Санкт-Петербург", "serious", 187, "Писатель", "books,theatre,wine,psychology,podcasts", "Пишу роман третий год. Обещаю не делать тебя персонажем без согласия."],
  ["Лев", 24, "male", "everyone", "Екатеринбург", "chat", 177, "Data scientist", "tech,science,boardgames,cycling,games", "Обучаю нейросети и проигрываю им в шахматы. В настолках пока держусь."],

  // ── Другое ──
  ["Саня", 26, "other", "everyone", "Москва", "friends", 172, "Тату-мастер", "art,music,concerts,pets,fashion", "Рисую на коже и на бумаге. Три кошки, ноль сожалений."],
  ["Рен", 23, "other", "everyone", "Санкт-Петербург", "chat", 168, "Переводчик с японского", "anime,languages,books,games,travel", "Перевожу мангу и субтитры. Могу объяснить разницу между 14 видами «извините»."],
  ["Ари", 29, "other", "everyone", "Москва", "dating", 175, "Саунд-дизайнер", "music,tech,movies,nightlife,podcasts", "Делаю звук для кино и игр. Слышу, когда холодильник гудит не в той тональности."],
];

export const SEED_PROFILES: SeedProfile[] = rows.map(
  ([name, age, gender, lookingFor, city, goal, heightCm, job, interests, bio]) => ({
    name,
    age,
    gender,
    lookingFor,
    city,
    goal,
    heightCm,
    job,
    bio,
    interests: interests.split(","),
  }),
);

// Варианты причёсок иллюстраций Lorelei, подобранные вручную по контактному листу
export const HAIR = {
  male: [1, 2, 3, 4, 5, 6, 7, 8, 9, 22, 27, 28, 39, 43, 44, 47],
  female: [10, 13, 14, 15, 16, 17, 18, 19, 21, 23, 24, 26, 29, 31, 32, 33, 35, 37, 38, 40, 41, 42, 45, 46, 48],
  other: [11, 12, 20, 25, 30, 34, 36],
} as const;

// Пары цветов для градиентного фона портретов
export const GRADIENTS: [string, string][] = [
  ["#ff9a8b", "#ff6a88"],
  ["#a18cd1", "#fbc2eb"],
  ["#84fab0", "#8fd3f4"],
  ["#fccb90", "#d57eeb"],
  ["#f6d365", "#fda085"],
  ["#89f7fe", "#66a6ff"],
  ["#fddb92", "#d1fdff"],
  ["#c2e9fb", "#a1c4fd"],
  ["#ffecd2", "#fcb69f"],
  ["#d4fc79", "#96e6a1"],
  ["#e0c3fc", "#8ec5fc"],
  ["#f093fb", "#f5576c"],
];
