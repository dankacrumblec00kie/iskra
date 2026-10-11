"use client";

import { LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Avatar, ScreenLoader, Switch } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { useConfig, useMe } from "@/lib/client/hooks";
import { disablePush, enablePush, getPushSubscription, pushSupported } from "@/lib/client/push";
import { formatPrice } from "@/lib/shared/products";
import type { Me, PhotoDto } from "@/lib/shared/types";

type Blocked = { id: string; name: string; photo: PhotoDto | null };
type Payment = { id: string; title: string; amountMinor: number; paidAt: string | null };

export function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data: me, mutate: mutateMe } = useMe();
  const { data: config } = useConfig();
  const { data: blocked, mutate: mutateBlocked } = useSWR<{ blocked: Blocked[] }>("/api/blocks", fetcher);
  const { data: purchases } = useSWR<{ payments: Payment[] }>("/api/billing/payments", fetcher);

  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);

  // Состояние подписки хранит браузер — узнаём его после монтирования
  useEffect(() => {
    void getPushSubscription().then((subscription) => setPushOn(subscription !== null));
  }, []);

  if (!me?.profile) return <ScreenLoader />;

  async function toggleVisibility(isVisible: boolean) {
    setVisibilityBusy(true);
    try {
      await mutateMe(await api<Me>("/api/me", { method: "PATCH", body: { isVisible } }), { revalidate: false });
      toast(isVisible ? "Анкета снова в ленте" : "Анкета скрыта из ленты", "success");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setVisibilityBusy(false);
  }

  async function togglePush(next: boolean) {
    if (!config?.vapidPublicKey) return;
    setPushBusy(true);
    try {
      if (next) await enablePush(config.vapidPublicKey);
      else await disablePush();
      setPushOn(next);
      toast(next ? "Уведомления включены" : "Уведомления выключены", "success");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setPushBusy(false);
  }

  async function unblock(id: string) {
    try {
      await api(`/api/blocks/${id}`, { method: "DELETE" });
      await mutateBlocked();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  /** Выход и удаление заканчиваются одинаково: чистим кэш данных и уходим на главную. */
  async function leave(kind: "logout" | "delete") {
    setBusy(kind);
    try {
      if (kind === "delete") await api("/api/me", { method: "DELETE" });
      else await api("/api/auth/logout", { method: "POST" });
      await mutateGlobal(() => true, undefined, { revalidate: false });
      router.replace("/");
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(null);
    }
  }

  const pushAvailable = pushSupported() && Boolean(config?.vapidPublicKey);

  return (
    <Screen title="Настройки" back="/profile">
      <Group title="Приватность">
        <Row
          title="Показывать меня в ленте"
          text="Если выключить, новые люди вас не увидят. Пары и переписка сохранятся."
          control={
            <Switch
              checked={me.profile.isVisible}
              onChange={toggleVisibility}
              disabled={visibilityBusy}
              label="Показывать меня в ленте"
            />
          }
        />
      </Group>

      <Group title="Уведомления">
        <Row
          title="Push-уведомления"
          text={
            pushAvailable
              ? "Новые пары, лайки и сообщения — даже когда вкладка закрыта."
              : config && !config.vapidPublicKey
                ? "На этом сервере push не настроен (нет VAPID-ключей)."
                : "Этот браузер не поддерживает push-уведомления."
          }
          control={
            <Switch checked={pushOn} onChange={togglePush} disabled={!pushAvailable || pushBusy} label="Push-уведомления" />
          }
        />
      </Group>

      <Group title="Чёрный список">
        {!blocked ? (
          <p className="px-4 py-4 text-sm text-faint">Загрузка…</p>
        ) : blocked.blocked.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Вы никого не блокировали.</p>
        ) : (
          blocked.blocked.map((user) => (
            <div key={user.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <Avatar photo={user.photo} name={user.name} size={40} />
              <span className="flex-1 truncate text-[15px] font-semibold">{user.name}</span>
              <Button variant="secondary" size="sm" onClick={() => unblock(user.id)}>
                Разблокировать
              </Button>
            </div>
          ))
        )}
      </Group>

      {purchases && purchases.payments.length > 0 && (
        <Group title="Покупки">
          {purchases.payments.map((payment) => (
            <div key={payment.id} className="flex items-baseline gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
              <span className="flex-1 font-semibold">{payment.title}</span>
              <span className="text-faint">{payment.paidAt ? formatDate(payment.paidAt) : ""}</span>
              <span>{formatPrice(payment.amountMinor)}</span>
            </div>
          ))}
        </Group>
      )}

      <Group title="Аккаунт">
        <div className="border-b border-line px-4 py-3.5">
          <div className="text-xs text-faint">E-mail</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">{me.email}</div>
        </div>
        <button
          type="button"
          onClick={() => leave("logout")}
          disabled={busy !== null}
          className="flex h-14 w-full items-center gap-3 border-b border-line px-4 text-[15px] font-semibold hover:bg-surface-2 disabled:opacity-50"
        >
          <LogOut className="size-5 text-muted" /> Выйти
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={busy !== null}
          className="flex h-14 w-full items-center gap-3 px-4 text-[15px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          <Trash2 className="size-5" /> Удалить аккаунт
        </button>
      </Group>

      <p className="mt-6 text-center text-xs text-faint">
        <Link href="/terms" className="hover:text-fg hover:underline">
          Правила сервиса
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:text-fg hover:underline">
          Конфиденциальность
        </Link>
      </p>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Удалить аккаунт?" size="sm">
        <p className="text-sm leading-relaxed text-muted">
          Анкета, фотографии, пары и вся переписка будут удалены безвозвратно. Оплаченная подписка не переносится.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Отмена
          </Button>
          <Button variant="danger" className="flex-1" loading={busy === "delete"} onClick={() => leave("delete")}>
            Удалить навсегда
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2.5 text-xs font-bold tracking-wider text-faint uppercase">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">{children}</div>
    </section>
  );
}

function Row({ title, text, control }: { title: string; text: string; control: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="flex-1">
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="mt-0.5 text-sm leading-snug text-muted">{text}</div>
      </div>
      {control}
    </div>
  );
}
