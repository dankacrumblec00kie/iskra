"use client";

import { Ban, Check } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Screen } from "@/components/screen";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar, EmptyState, ErrorState, ScreenLoader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import { formatListTime } from "@/lib/client/format";
import { useMe } from "@/lib/client/hooks";
import { formatPrice } from "@/lib/shared/products";
import type { AdminReport, AdminStats } from "@/lib/shared/types";

/** Панель модератора: сводные показатели и очередь жалоб. Доступ проверяет сервер. */
export function AdminScreen() {
  const toast = useToast();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const { data: stats, error: statsError, mutate: mutateStats } = useSWR<AdminStats>(isAdmin ? "/api/admin/stats" : null, fetcher);
  const {
    data: queue,
    error: queueError,
    mutate: mutateQueue,
  } = useSWR<{ reports: AdminReport[] }>(isAdmin ? "/api/admin/reports" : null, fetcher);
  const [busy, setBusy] = useState<string | null>(null);

  if (!me) return <ScreenLoader />;
  if (!isAdmin) {
    return (
      <Screen title="Модерация" back="/profile">
        <EmptyState emoji="🔒" title="Нет доступа" text="Этот раздел открыт только администраторам.">
          <LinkButton href="/discover">В ленту</LinkButton>
        </EmptyState>
      </Screen>
    );
  }

  async function decide(report: AdminReport, action: "dismiss" | "ban") {
    setBusy(report.id);
    try {
      await api(`/api/admin/reports/${report.id}`, { method: "POST", body: { action } });
      toast(action === "ban" ? `${report.reported.name}: аккаунт заблокирован` : "Жалоба отклонена", "success");
      await Promise.all([mutateQueue(), mutateStats()]);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
    setBusy(null);
  }

  const cards: [label: string, value: string | number][] = stats
    ? [
        ["Пользователей", stats.users],
        ["С анкетой", stats.onboarded],
        ["Новых за неделю", stats.newThisWeek],
        ["С Premium", stats.premium],
        ["Пар", stats.matches],
        ["Сообщений", stats.messages],
        ["Покупок", stats.purchases],
        ["Выручка", formatPrice(stats.revenueMinor)],
      ]
    : [];

  return (
    <Screen wide title="Модерация" back="/profile">
      <h2 className="mb-3 text-xs font-bold tracking-wider text-faint uppercase">Показатели</h2>
      {statsError ? (
        <ErrorState message={errorMessage(statsError)} onRetry={() => mutateStats()} />
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats
            ? cards.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1.5 font-display text-xl font-bold">{value}</dd>
                </div>
              ))
            : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20" />)}
        </dl>
      )}
      <p className="mt-2 text-xs text-faint">Без учёта демо-анкет. Заблокировано аккаунтов: {stats?.banned ?? "…"}</p>

      <h2 className="mt-8 mb-3 text-xs font-bold tracking-wider text-faint uppercase">
        Жалобы{stats ? ` · открыто ${stats.openReports}` : ""}
      </h2>
      {queueError ? (
        <ErrorState message={errorMessage(queueError)} onRetry={() => mutateQueue()} />
      ) : !queue ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : queue.reports.length === 0 ? (
        <EmptyState emoji="✅" title="Очередь пуста" text="Новых жалоб нет." />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.reports.map((report) => (
            <li key={report.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <div className="flex items-start gap-3.5">
                <Avatar photo={report.reported.photo} name={report.reported.name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold">{report.reported.name}</span>
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">{report.reason}</span>
                    <span className="ml-auto text-xs text-faint">{formatListTime(report.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Пожаловался: {report.reporterName} · всего жалоб на анкету: {report.reported.totalReports}
                  </p>
                  {report.details && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">«{report.details}»</p>}
                  {report.reported.bio && (
                    <p className="mt-2 line-clamp-2 text-sm text-faint">Анкета: {report.reported.bio}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  icon={<Check className="size-4" />}
                  disabled={busy === report.id}
                  onClick={() => decide(report, "dismiss")}
                >
                  Отклонить
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  icon={<Ban className="size-4" />}
                  disabled={busy === report.id}
                  onClick={() => decide(report, "ban")}
                >
                  Заблокировать
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
