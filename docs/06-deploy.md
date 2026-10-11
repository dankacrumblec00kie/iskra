# Деплой

Приложение пока запускалось только локально. Ниже — шаги, которые нужно выполнить самостоятельно: для них нужны
ваши аккаунты GitHub и Vercel. Всё бесплатно на стартовых тарифах.

> Ни один из способов ниже ещё не проверен на практике. Если какой-то шаг пойдёт не так, покажите текст ошибки
> AI-агенту — конфигурация лежит в `vercel.json`, `Dockerfile` и `.github/workflows/ci.yml`.

## Вариант А. Vercel + Neon (рекомендуется)

### 1. Опубликовать репозиторий

1. Создайте на github.com пустой **публичный** репозиторий, например `iskra`, без README.
2. В терминале VS Code в папке проекта:

```powershell
git remote add origin https://github.com/ВАШ_ЛОГИН/iskra.git
git push -u origin main
```

После первого push запустится пайплайн CI — вкладка **Actions** в репозитории. Он впервые выполнится именно
там, поэтому загляните в результат: если шаг упал, его лог подскажет причину.

> Коммиты подписаны именем `DaNya` и адресом `ddankin318@gmail.com`. Поменять на будущее:
> `git config user.name "Имя Фамилия"`.

### 2. Создать проект на Vercel

1. vercel.com → **Add New → Project** → импортируйте репозиторий. Настройки сборки менять не нужно:
   `vercel.json` уже задаёт команду `npm run db:migrate && npm run build`.
2. Первый деплой **упадёт** — базы ещё нет. Это ожидаемо, переходите к шагу 3.

### 3. Подключить базу и хранилище

В проекте на Vercel откройте вкладку **Storage**:

1. **Create Database → Neon (Postgres)**, регион Frankfurt. Vercel сам добавит переменную `DATABASE_URL`.
2. **Create Database → Blob**. Vercel сам добавит `BLOB_READ_WRITE_TOKEN`.

### 4. Переменные окружения

**Settings → Environment Variables**:

| Переменная | Значение | Зачем |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://ваш-проект.vercel.app` | Ссылки для OAuth и платежей |
| `STORAGE_DRIVER` | `blob` | Фото хранятся в Vercel Blob |
| `PAYMENT_PROVIDER` | `demo` | Тестовая касса для защиты проекта |
| `DEMO_MODE` | `true` | Демо-анкеты отвечают взаимностью |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | из `npm run push:keys` | Push-уведомления (необязательно) |
| `NEXT_PUBLIC_YM_ID` | номер счётчика | Яндекс.Метрика (необязательно) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | из Google Cloud Console | Вход через Google (необязательно) |

Затем **Deployments → … → Redeploy**. Сборка применит миграции и выкатит приложение.

### 5. Наполнить демо-данными

Сид запускается с вашего компьютера, но пишет в боевую базу и хранилище. Значения возьмите на Vercel:
**Storage → база → `.env.local`**.

```powershell
$env:DATABASE_URL = "postgres://…neon.tech/neondb?sslmode=require"
$env:STORAGE_DRIVER = "blob"
$env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_…"
npm run db:seed
```

Закройте терминал после этого — чтобы переменные не остались в сессии и `npm run dev` не подключился к боевой базе.

### 6. Проверить

- Откройте сайт, нажмите **Войти в демо-аккаунт**.
- Зарегистрируйте нового пользователя, пройдите анкету, поставьте лайк.
- Впишите ссылку на сайт в `README.md` (раздел «Демо») и сделайте push.

### CI/CD после настройки

| Событие | Что происходит |
| --- | --- |
| Push в `main` | GitHub Actions: линтер, типы, тесты, сборка, e2e. Vercel: миграции и выкатка в продакшен |
| Pull request | Те же проверки; Vercel создаёт отдельное preview-окружение со своей ссылкой |

### Необязательные интеграции

- **Вход через Google.** Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
  Redirect URI: `https://ваш-проект.vercel.app/api/auth/google/callback`.
- **ЮKassa.** Нужен магазин (для теста — тестовый). `PAYMENT_PROVIDER=yookassa`, `YOOKASSA_SHOP_ID`,
  `YOOKASSA_SECRET_KEY`; в кабинете укажите URL уведомлений `https://ваш-проект.vercel.app/api/billing/webhook/yookassa`.
  После переключения уберите `DEMO_MODE`.
- **Яндекс.Метрика.** Создайте счётчик, добавьте цели `onboarding_complete`, `match`, `checkout_start`, `purchase`.

## Вариант Б. Свой сервер (VPS, Timeweb) через Docker

Нужен сервер с Docker и Docker Compose.

```bash
git clone https://github.com/ВАШ_ЛОГИН/iskra.git && cd iskra
cat > .env <<'EOF'
POSTGRES_PASSWORD=придумайте-длинный-пароль
NEXT_PUBLIC_APP_URL=https://ваш-домен.ru
PAYMENT_PROVIDER=demo
DEMO_MODE=true
EOF
docker compose up -d --build
```

Compose поднимет PostgreSQL, применит миграции и запустит приложение на порту 3000. Перед ним нужен
обратный прокси с HTTPS (Caddy или nginx): без HTTPS не работают cookie сессии с флагом `Secure` и push-уведомления.

Наполнение демо-данными для этого варианта не автоматизировано: сид пишет фото в локальную папку, а у контейнера
приложения она в отдельном томе. Если демо-анкеты нужны на своём сервере, это потребует доработки compose
(общий том для сида и приложения).

Автодеплой для VPS в проекте не настроен: в CI есть только проверки. Его можно добавить отдельным шагом
(SSH на сервер и `docker compose up -d --build`).

## Ограничения бесплатных тарифов

- **Vercel Hobby** запрещает коммерческое использование. Для приёма настоящих платежей нужен тариф Pro или свой сервер.
- **Neon Free** усыпляет базу без запросов; первый запрос после паузы идёт около секунды.
- **Open-Meteo** бесплатен только для некоммерческого использования; для продукта нужен платный геокодер.
