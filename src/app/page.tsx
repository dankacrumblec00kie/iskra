import { Compass, Flame, Heart, MapPin, MessageCircle, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Flame,
    title: "Лента свайпов",
    text: "Листайте анкеты одним движением. Вправо — нравится, влево — дальше, вверх — суперлайк.",
  },
  {
    icon: Compass,
    title: "Люди рядом",
    text: "Сетка анкет по расстоянию с поиском по интересам, профессии и городу.",
  },
  {
    icon: Heart,
    title: "Только взаимно",
    text: "Написать можно лишь тому, кто тоже вас лайкнул. Никаких непрошеных сообщений.",
  },
  {
    icon: MessageCircle,
    title: "Живой чат",
    text: "Переписка с отметками о прочтении и подсказками для первого сообщения.",
  },
  {
    icon: ShieldCheck,
    title: "Безопасность",
    text: "Жалобы и блокировка в два касания. Ваши координаты никто не видит — только примерное расстояние.",
  },
  {
    icon: Sparkles,
    title: "Свои правила",
    text: "Сами выбираете, кого показывать: мужчин, женщин или всех. И кому показываться.",
  },
] as const;

const STEPS = [
  { n: "1", title: "Создайте анкету", text: "Пара фото, интересы и несколько слов о себе — две минуты." },
  { n: "2", title: "Отмечайте, кто нравится", text: "В ленте или среди людей рядом. Лайк остаётся тайной, пока он не взаимен." },
  { n: "3", title: "Общайтесь", text: "Совпало — открывается чат. Дальше всё зависит от вас двоих." },
] as const;

export default function LandingPage() {
  return (
    <div className="relative overflow-x-clip">
      <div
        className="pointer-events-none absolute -top-56 left-1/2 size-[52rem] -translate-x-1/2 rounded-full bg-spark opacity-20 blur-[140px]"
        aria-hidden
      />

      <header className="relative mx-auto flex h-18 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm">
            Войти
          </LinkButton>
          <LinkButton href="/register" size="sm">
            Создать анкету
          </LinkButton>
        </nav>
      </header>

      <main className="relative">
        {/* ── Первый экран ── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-20 lg:grid-cols-2 lg:pt-20 lg:pb-28">
          <div className="animate-slide-up text-center lg:text-left">
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-xs font-semibold text-muted ring-1 ring-line">
              <span className="size-2 rounded-full bg-like" /> Знакомства для взрослых · 18+
            </span>
            <h1 className="mt-6 font-display text-[2.6rem] leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Знакомства,
              <br />в которых есть <span className="text-spark">искра</span>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-muted lg:mx-0">
              Смотрите, кто рядом, отмечайте, кто нравится, и общайтесь только с теми, кому вы тоже интересны.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <LinkButton href="/register" size="lg" className="w-full sm:w-auto">
                Начать бесплатно
              </LinkButton>
              <LinkButton href="/login" size="lg" variant="outline" className="w-full sm:w-auto">
                У меня есть аккаунт
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-faint">Регистрация по e-mail за минуту. Без рекламы и спама.</p>
          </div>

          <HeroCards />
        </section>

        {/* ── Возможности ── */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Всё, чтобы найти своих</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted">
            Никакой перегруженности: только то, что помогает познакомиться и начать разговор.
          </p>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="rounded-card bg-surface p-6 ring-1 ring-line transition hover:-translate-y-1 hover:ring-brand/50"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft">
                  <feature.icon className="size-6 text-brand" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Как это работает ── */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="rounded-[2.5rem] bg-surface px-6 py-12 ring-1 ring-line sm:px-12">
            <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Три шага до первого сообщения</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="text-center">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-spark font-display text-xl font-bold text-white glow-brand">
                    {step.n}
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Призыв ── */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-spark px-6 py-14 text-center text-white sm:px-12">
            <span className="pointer-events-none absolute -top-10 -left-6 text-[12rem] leading-none opacity-15" aria-hidden>
              ✦
            </span>
            <span className="pointer-events-none absolute -right-4 -bottom-16 text-[14rem] leading-none opacity-15" aria-hidden>
              ✦
            </span>
            <h2 className="relative font-display text-3xl font-bold sm:text-4xl">Кто-то рядом уже ждёт</h2>
            <p className="relative mx-auto mt-3 max-w-md text-white/90">Создайте анкету и посмотрите, кому вы понравитесь уже сегодня.</p>
            <Link
              href="/register"
              className="relative mt-8 inline-flex h-13 items-center justify-center rounded-full bg-white px-8 font-semibold text-black transition hover:scale-105 active:scale-95"
            >
              Создать анкету
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-8 text-sm text-faint sm:flex-row sm:justify-between">
          <Logo size="sm" className="text-fg" />
          <nav className="flex gap-5">
            <Link href="/terms" className="hover:text-fg">
              Правила
            </Link>
            <Link href="/privacy" className="hover:text-fg">
              Конфиденциальность
            </Link>
          </nav>
          <span>Учебный проект · 18+</span>
        </div>
      </footer>
    </div>
  );
}

/** Декоративная стопка карточек: показывает интерфейс ленты до регистрации. */
function HeroCards() {
  return (
    <div className="relative mx-auto h-[30rem] w-full max-w-sm select-none sm:h-[34rem]" aria-hidden>
      <div
        className="absolute top-6 left-0 h-[78%] w-[62%] animate-float overflow-hidden rounded-card opacity-70 shadow-2xl ring-1 ring-white/10"
        style={{ "--tilt": "-9deg", animationDelay: "-2s" } as React.CSSProperties}
      >
        <Image src="/landing/3.webp" alt="" fill sizes="240px" className="object-cover" />
      </div>
      <div
        className="absolute top-10 right-0 h-[78%] w-[62%] animate-float overflow-hidden rounded-card opacity-70 shadow-2xl ring-1 ring-white/10"
        style={{ "--tilt": "8deg", animationDelay: "-4s" } as React.CSSProperties}
      >
        <Image src="/landing/5.webp" alt="" fill sizes="240px" className="object-cover" />
      </div>

      <div className="absolute inset-x-[12%] top-0 bottom-16 animate-float overflow-hidden rounded-card shadow-2xl ring-1 ring-white/15">
        <Image src="/landing/1.webp" alt="" fill sizes="320px" priority className="object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pt-20 pb-5">
          <div className="flex items-center gap-2 font-display text-2xl font-bold">
            Аня, 24 <span className="size-2.5 rounded-full bg-like" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
            <MapPin className="size-4" /> Москва · 3 км
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold whitespace-nowrap">
            <span className="rounded-full bg-brand/85 px-2.5 py-1">☕ Кофе</span>
            <span className="rounded-full bg-brand/85 px-2.5 py-1">✈️ Путешествия</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">🎨 Искусство</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-nope ring-1 ring-nope/40">
          <X className="size-7" strokeWidth={2.6} />
        </span>
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-super ring-1 ring-super/40">
          <Star className="size-5 fill-current" />
        </span>
        <span className="flex size-14 items-center justify-center rounded-full bg-spark text-white glow-brand">
          <Heart className="size-7 fill-current" />
        </span>
      </div>

      <span className="absolute top-24 -right-2 animate-pop rounded-2xl bg-white px-3.5 py-2 text-sm font-bold text-black shadow-xl [animation-delay:600ms] sm:-right-8">
        Это взаимно! 🎉
      </span>
    </div>
  );
}
