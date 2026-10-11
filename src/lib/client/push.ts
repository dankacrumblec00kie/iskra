import { api } from "./api";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** VAPID-ключ приходит в base64url, а PushManager ждёт массив байтов. */
function decodeKey(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Запрашивает разрешение, подписывает браузер и сохраняет подписку на сервере. */
export async function enablePush(vapidPublicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Уведомления запрещены в настройках браузера. Разрешите их для этого сайта");
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(vapidPublicKey),
    }));
  await api("/api/push/subscription", { method: "POST", body: subscription.toJSON() });
}

export async function disablePush() {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await api("/api/push/subscription", { method: "DELETE", body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}
