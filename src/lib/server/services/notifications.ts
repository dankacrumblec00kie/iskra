import { and, desc, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { NotificationDto } from "@/lib/shared/types";
import { sendPush } from "./push";

export type NotificationType = "match" | "like" | "superlike" | "message" | "premium" | "boost";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  /** Данные для отрисовки в списке уведомлений */
  payload?: Record<string, unknown>;
  /** Текст push-уведомления; без него push не отправляется */
  push?: { title: string; body: string; url: string };
  /** false — только push, без записи в ленту (например, для сообщений чата) */
  persist?: boolean;
};

/**
 * Единая точка отправки уведомлений: запись в ленту + web push.
 * Push уходит после ответа клиенту (after), чтобы не задерживать запрос.
 */
export async function notify({ userId, type, payload = {}, push, persist = true }: NotifyInput) {
  if (persist) await db.insert(notifications).values({ userId, type, payload });
  if (push) {
    after(() => sendPush(userId, { ...push, tag: type }).catch((e) => console.error("[push]", e)));
  }
}

export async function listNotifications(userId: string): Promise<NotificationDto[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    payload: n.payload,
    createdAt: n.createdAt.toISOString(),
    read: n.readAt !== null,
  }));
}

export async function markNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
