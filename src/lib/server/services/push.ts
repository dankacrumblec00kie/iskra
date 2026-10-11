import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export type PushMessage = { title: string; body: string; url: string; tag?: string };

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

/** Web Push включён, только если заданы VAPID-ключи (npm run push:keys). */
export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    publicKey!,
    privateKey!,
  );
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Отправляет push на все устройства пользователя. Протухшие подписки удаляет. */
export async function sendPush(userId: string, message: PushMessage) {
  if (!pushEnabled) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return;

  const expired: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 },
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 — браузер отозвал подписку
        if (status === 404 || status === 410) expired.push(sub.id);
        else console.error("[push] ошибка отправки:", status ?? error);
      }
    }),
  );

  if (expired.length) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expired));
  }
}
