"use client";

import { Bell, ChevronRight, Crown, EyeOff, Pencil, Settings, Shield, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Screen } from "@/components/screen";
import { LinkButton } from "@/components/ui/button";
import { Photo, ScreenLoader, Tag } from "@/components/ui/misc";
import { formatDate } from "@/lib/client/format";
import { useMe } from "@/lib/client/hooks";
import { GOAL_EMOJI, GOAL_LABEL, LOOKING_FOR_LABEL } from "@/lib/shared/constants";
import { INTEREST_BY_SLUG } from "@/lib/shared/interests";

/** Насколько заполнена анкета — мягкий стимул добавить фото и рассказ о себе. */
function completeness(input: { photos: number; bio: string; job: string; height: number | null; interests: number }) {
  const parts = [
    Math.min(input.photos, 3) / 3,
    input.bio.length >= 40 ? 1 : input.bio.length / 40,
    input.job ? 1 : 0,
    input.height ? 1 : 0,
    Math.min(input.interests, 5) / 5,
  ];
  return Math.round((parts.reduce((sum, part) => sum + part, 0) / parts.length) * 100);
}

/** Оставшееся время буста; тикает раз в секунду, пока буст активен. */
function useCountdown(until: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, new Date(until).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  if (!until || left <= 0) return null;
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MyProfileScreen() {
  const { data: me } = useMe();
  const boostLeft = useCountdown(me?.profile?.boostedUntil ?? null);

  if (!me?.profile) return <ScreenLoader />;
  const { profile } = me;
  const percent = completeness({
    photos: me.photos.length,
    bio: profile.bio,
    job: profile.job,
    height: profile.heightCm,
    interests: me.interests.length,
  });

  return (
    <Screen
      title="Профиль"
      actions={
        <Link
          href="/settings"
          aria-label="Настройки"
          className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
        >
          <Settings className="size-5" />
        </Link>
      }
    >
      <section className="flex items-center gap-4 rounded-card bg-surface p-4 ring-1 ring-line">
        <Photo photo={me.photos[0]} alt={profile.name} className="size-24 shrink-0 rounded-3xl" eager />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="truncate">
              {profile.name}, {profile.age}
            </span>
            {me.isPremium && <Crown className="size-5 shrink-0 text-gold" aria-label="Premium" />}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted">{profile.city}</p>
          <LinkButton href="/profile/edit" variant="secondary" size="sm" className="mt-3">
            <Pencil className="size-4" /> Редактировать
          </LinkButton>
        </div>
      </section>

      {!profile.isVisible && (
        <p className="mt-3 flex items-center gap-2.5 rounded-2xl bg-gold/10 px-4 py-3 text-sm text-gold">
          <EyeOff className="size-4 shrink-0" />
          Анкета скрыта: вас не показывают в ленте. Включить показ можно в настройках.
        </p>
      )}

      {percent < 100 && (
        <Link href="/profile/edit" className="mt-3 block rounded-2xl bg-surface p-4 ring-1 ring-line transition hover:ring-brand/50">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Анкета заполнена на {percent}%</span>
            <span className="text-brand">Дополнить</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-spark" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-faint">Подробные анкеты получают заметно больше взаимных симпатий</p>
        </Link>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/premium" className="rounded-3xl bg-spark p-4 text-white transition hover:brightness-110">
          <Crown className="size-6" />
          <div className="mt-2 font-display text-sm font-bold">{me.isPremium ? "Premium активен" : "Искра Premium"}</div>
          <div className="mt-1 text-xs text-white/85">
            {me.isPremium && me.premiumUntil ? `до ${formatDate(me.premiumUntil)}` : "Безлимит и список симпатий"}
          </div>
        </Link>
        <Link href="/premium#boost" className="rounded-3xl bg-surface p-4 ring-1 ring-line transition hover:ring-gold/60">
          <Zap className="size-6 text-gold" />
          <div className="mt-2 font-display text-sm font-bold">{boostLeft ? "Буст активен" : "Буст"}</div>
          <div className="mt-1 text-xs text-muted">{boostLeft ? `осталось ${boostLeft}` : "Первым в ленте на 30 минут"}</div>
        </Link>
      </div>

      <section className="mt-6">
        <h3 className="mb-2.5 text-xs font-bold tracking-wider text-faint uppercase">О себе</h3>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p className="leading-relaxed whitespace-pre-line text-fg/90">
            {profile.bio || <span className="text-faint">Пока пусто. Пара строк о себе помогает начать разговор.</span>}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Tag>
              <span aria-hidden>{GOAL_EMOJI[profile.goal]}</span>
              {GOAL_LABEL[profile.goal]}
            </Tag>
            {me.interests.map((slug) => {
              const interest = INTEREST_BY_SLUG.get(slug);
              return interest ? (
                <Tag key={slug}>
                  <span aria-hidden>{interest.emoji}</span>
                  {interest.label}
                </Tag>
              ) : null;
            })}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2.5 text-xs font-bold tracking-wider text-faint uppercase">Поиск</h3>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Показывать" value={LOOKING_FOR_LABEL[profile.lookingFor]} />
          <Stat label="Возраст" value={`${profile.ageMin}–${profile.ageMax}`} />
          <Stat label="Расстояние" value={profile.maxDistanceKm >= 500 ? "неважно" : `${profile.maxDistanceKm} км`} />
        </dl>
      </section>

      <nav className="mt-6 flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line lg:hidden" aria-label="Разделы профиля">
        <RowLink href="/notifications" icon={<Bell className="size-5" />}>
          Уведомления
        </RowLink>
        <RowLink href="/settings" icon={<Shield className="size-5" />}>
          Настройки и безопасность
        </RowLink>
        {me.role === "admin" && (
          <RowLink href="/admin" icon={<ShieldCheck className="size-5" />}>
            Модерация
          </RowLink>
        )}
      </nav>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3 ring-1 ring-line">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 truncate text-sm font-bold">{value}</dd>
    </div>
  );
}

function RowLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className="flex h-14 items-center gap-3 border-b border-line px-4 text-[15px] font-semibold last:border-0 hover:bg-surface-2">
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-5 text-faint" />
    </Link>
  );
}
