"use client";

import clsx from "clsx";
import { ArrowLeft, Check, CheckCheck, CircleAlert, EllipsisVertical, Flag, HeartCrack, Send, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ReportSheet } from "@/components/profile/report-sheet";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, EmptyState, ErrorState, Photo, ScreenLoader, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError, errorMessage, fetcher } from "@/lib/client/api";
import { formatDayLabel, formatTime, isSameDay } from "@/lib/client/format";
import { KEYS } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/shared/constants";
import { INTEREST_BY_SLUG } from "@/lib/shared/interests";
import type { ChatThread, MessageDto, ProfileCard } from "@/lib/shared/types";

const PAGE_SIZE = 50;
const POLL_MS = 2500;

type Outgoing = { tempId: string; body: string; failed: boolean };

/** Объединяет списки сообщений без дублей, в хронологическом порядке. */
function merge(...lists: MessageDto[][]) {
  const byId = new Map<string, MessageDto>();
  for (const list of lists) for (const message of list) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function ChatScreen({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const key = `/api/matches/${matchId}/messages`;

  // История, накопленная за время жизни экрана (опрос возвращает только последнюю страницу)
  const [history, setHistory] = useState<MessageDto[]>([]);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [text, setText] = useState("");
  const [noOlder, setNoOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);

  // Обновление чата опросом раз в 2,5 секунды: работает на любом хостинге, включая serverless
  const { data, error, mutate } = useSWR<ChatThread, ApiRequestError>(key, fetcher, {
    refreshInterval: POLL_MS,
    dedupingInterval: 1000,
    shouldRetryOnError: (e) => e.status !== 404,
    onSuccess: (thread) => setHistory((current) => merge(current, thread.messages)),
  });

  const messages = merge(history, data?.messages ?? []);
  const user = data?.match.user;

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const lastCount = useRef(0);

  // Новые сообщения прокручивают чат вниз, только если пользователь и так был внизу
  useLayoutEffect(() => {
    const el = scroller.current;
    const count = messages.length + outbox.length;
    if (el && count !== lastCount.current && stickToBottom.current) el.scrollTop = el.scrollHeight;
    lastCount.current = count;
  }, [messages.length, outbox.length]);

  // Счётчики в навигации обновляем сразу, как чат прочитан
  useEffect(() => {
    if (data) void mutateGlobal(KEYS.counters);
  }, [data?.messages.length, mutateGlobal]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: card } = useSWR<ProfileCard>(
    user && messages.length === 0 ? `/api/users/${user.id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  async function send(body: string, retryId?: string) {
    const tempId = retryId ?? crypto.randomUUID();
    setOutbox((list) =>
      retryId
        ? list.map((item) => (item.tempId === retryId ? { ...item, failed: false } : item))
        : [...list, { tempId, body, failed: false }],
    );
    stickToBottom.current = true;
    try {
      const message = await api<MessageDto>(key, { method: "POST", body: { body } });
      setHistory((current) => merge(current, [message]));
      setOutbox((list) => list.filter((item) => item.tempId !== tempId));
      void mutateGlobal(KEYS.matches);
    } catch (e) {
      setOutbox((list) => list.map((item) => (item.tempId === tempId ? { ...item, failed: true } : item)));
      toast(errorMessage(e), "error");
    }
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText("");
    if (input.current) input.current.style.height = "auto";
    void send(body);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // На телефоне Enter — перенос строки, отправка кнопкой
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (event.key === "Enter" && !event.shiftKey && !touch && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  async function loadOlder() {
    const first = messages[0];
    const el = scroller.current;
    if (!first || !el) return;
    setLoadingOlder(true);
    const previousHeight = el.scrollHeight;
    try {
      const page = await api<ChatThread>(`${key}?before=${encodeURIComponent(first.createdAt)}`);
      if (page.messages.length < PAGE_SIZE) setNoOlder(true);
      stickToBottom.current = false;
      setHistory((current) => merge(page.messages, current));
      // Сохраняем позицию: то, что читал пользователь, остаётся на месте
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - previousHeight;
      });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
    setLoadingOlder(false);
  }

  async function unmatch() {
    setUnmatching(true);
    try {
      await api(`/api/matches/${matchId}`, { method: "DELETE" });
      await mutateGlobal(KEYS.matches);
      router.replace("/matches");
    } catch (e) {
      toast(errorMessage(e), "error");
      setUnmatching(false);
    }
  }

  const shell = "fixed inset-0 z-40 flex flex-col bg-bg lg:static lg:z-auto lg:mx-auto lg:h-dvh lg:w-full lg:max-w-2xl lg:border-x lg:border-line";

  if (error?.status === 404) {
    return (
      <div className={shell}>
        <EmptyState emoji="🕊️" title="Чат недоступен" text="Пара была удалена или пользователь вас заблокировал.">
          <LinkButton href="/matches">К списку чатов</LinkButton>
        </EmptyState>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className={shell}>
        <ErrorState message={error.message} onRetry={() => mutate()} />
      </div>
    );
  }
  if (!data || !user) {
    return (
      <div className={shell}>
        <ScreenLoader />
      </div>
    );
  }

  const canLoadOlder = !noOlder && messages.length >= PAGE_SIZE;
  const shared = (card?.sharedInterests ?? []).map((slug) => INTEREST_BY_SLUG.get(slug)).filter((i) => i !== undefined);
  const starters = [
    ...(shared[0] ? [`Вижу, нам обоим нравится ${shared[0].label.toLowerCase()} ${shared[0].emoji} С чего у тебя началось?`] : []),
    "Привет! Как проходит день?",
    "Что тебя в последнее время по-настоящему порадовало?",
    "Идеальные выходные — это как?",
  ].slice(0, 3);

  return (
    <div className={shell}>
      <header className="flex h-16 shrink-0 items-center gap-1 border-b border-line bg-bg/90 px-2 backdrop-blur-xl">
        <Link
          href="/matches"
          aria-label="К списку чатов"
          className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={`/u/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 py-1 hover:bg-surface">
          <Avatar photo={user.photo} name={user.name} size={42} online={user.online} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold">
              {user.name}, {user.age}
            </span>
            <span className={clsx("block text-xs", user.online ? "text-like" : "text-faint")}>
              {user.online ? "в сети" : "не в сети"}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Действия с чатом"
          className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <EllipsisVertical className="size-5" />
        </button>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="flex-1 overflow-y-auto px-3 py-4"
        role="log"
        aria-live="polite"
        aria-label={`Переписка с ${user.name}`}
      >
        {canLoadOlder && (
          <div className="mb-4 flex justify-center">
            <Button variant="secondary" size="sm" loading={loadingOlder} onClick={loadOlder}>
              Показать более ранние
            </Button>
          </div>
        )}

        {messages.length === 0 && outbox.length === 0 && (
          <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-8 text-center animate-fade-in">
            <Photo photo={user.photo} alt={user.name} className="size-28 rounded-[2rem]" />
            <h2 className="mt-5 font-display text-lg font-bold">Вы понравились друг другу</h2>
            <p className="mt-1.5 text-sm text-muted">Напишите первым — {user.name} уже ждёт. Можно начать с этого:</p>
            <div className="mt-5 flex flex-col gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => {
                    setText(starter);
                    input.current?.focus();
                  }}
                  className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-left text-sm transition hover:border-brand/60"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        <ol className="flex flex-col gap-1">
          {messages.map((message, i) => {
            const previous = messages[i - 1];
            const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
            const grouped = !newDay && previous?.mine === message.mine;
            return (
              <li key={message.id} className={clsx("flex flex-col", !grouped && "mt-2")}>
                {newDay && (
                  <span className="mx-auto my-3 rounded-full bg-surface px-3 py-1 text-xs font-medium text-faint">
                    {formatDayLabel(message.createdAt)}
                  </span>
                )}
                <Bubble mine={message.mine} time={formatTime(message.createdAt)} status={message.mine ? (message.readAt ? "read" : "sent") : undefined}>
                  {message.body}
                </Bubble>
              </li>
            );
          })}
          {outbox.map((item) => (
            <li key={item.tempId} className="mt-1 flex flex-col">
              <Bubble mine status={item.failed ? "failed" : "sending"}>
                {item.body}
              </Bubble>
              {item.failed && (
                <button
                  type="button"
                  onClick={() => send(item.body, item.tempId)}
                  className="mt-1 self-end text-xs font-semibold text-danger hover:underline"
                >
                  Не отправлено. Повторить
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex shrink-0 items-end gap-2 border-t border-line bg-bg px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <textarea
          ref={input}
          rows={1}
          value={text}
          maxLength={LIMITS.messageMax}
          placeholder="Сообщение…"
          aria-label="Текст сообщения"
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          className="max-h-36 min-h-12 flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-3 text-[15px] leading-snug placeholder:text-faint focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Отправить"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-spark text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          <Send className="size-5" />
        </button>
      </form>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={user.name} size="sm">
        <div className="flex flex-col gap-1">
          <MenuLink href={`/u/${user.id}`} icon={<User className="size-5" />}>
            Открыть анкету
          </MenuLink>
          <MenuButton
            icon={<HeartCrack className="size-5" />}
            onClick={() => {
              setMenuOpen(false);
              setConfirmUnmatch(true);
            }}
          >
            Удалить пару
          </MenuButton>
          <MenuButton
            danger
            icon={<Flag className="size-5" />}
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          >
            Пожаловаться или заблокировать
          </MenuButton>
        </div>
      </Sheet>

      <Sheet open={confirmUnmatch} onClose={() => setConfirmUnmatch(false)} title="Удалить пару?" size="sm">
        <p className="text-sm leading-relaxed text-muted">
          Чат с {user.name} и вся переписка исчезнут у вас обоих. Отменить это действие нельзя.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmUnmatch(false)}>
            Отмена
          </Button>
          <Button variant="danger" className="flex-1" loading={unmatching} onClick={unmatch}>
            Удалить
          </Button>
        </div>
      </Sheet>

      <ReportSheet
        open={reportOpen}
        user={user}
        onClose={() => setReportOpen(false)}
        onDone={async () => {
          await mutateGlobal(KEYS.matches);
          router.replace("/matches");
        }}
      />
    </div>
  );
}

function Bubble({
  mine,
  time,
  status,
  children,
}: {
  mine: boolean;
  time?: string;
  status?: "sending" | "sent" | "read" | "failed";
  children: string;
}) {
  return (
    <div
      className={clsx(
        "max-w-[80%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap",
        mine ? "self-end rounded-br-lg bg-spark text-white" : "self-start rounded-bl-lg bg-surface-2",
        status === "sending" && "opacity-70",
        status === "failed" && "opacity-60 ring-2 ring-danger",
      )}
    >
      {children}
      <span className={clsx("ml-2 inline-flex translate-y-0.5 items-center gap-1 text-[11px]", mine ? "text-white/75" : "text-faint")}>
        {time}
        {status === "sending" && <Spinner className="size-3" />}
        {status === "sent" && <Check className="size-3.5" aria-label="Отправлено" />}
        {status === "read" && <CheckCheck className="size-3.5" aria-label="Прочитано" />}
        {status === "failed" && <CircleAlert className="size-3.5" aria-label="Не отправлено" />}
      </span>
    </div>
  );
}

const menuItem = "flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition hover:bg-surface-2";

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className={menuItem}>
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  );
}

function MenuButton({
  icon,
  danger,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={clsx(menuItem, danger && "text-danger")}>
      <span className={danger ? undefined : "text-muted"}>{icon}</span>
      {children}
    </button>
  );
}
