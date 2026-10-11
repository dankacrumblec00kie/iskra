import { requireUser } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { listNotifications, markNotificationsRead } from "@/lib/server/services/notifications";

export const GET = api(async () => ({
  notifications: await listNotifications((await requireUser()).id),
}));

// Отметить все прочитанными
export const POST = api(async () => {
  await markNotificationsRead((await requireUser()).id);
  return { ok: true };
});
