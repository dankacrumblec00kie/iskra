import { connection } from "next/server";
import { googleEnabled } from "@/lib/server/auth/google";
import { api } from "@/lib/server/http";
import { paymentProvider } from "@/lib/server/services/billing";
import { demoMode } from "@/lib/server/services/demo";
import { pushEnabled } from "@/lib/server/services/push";

// Публичные настройки для интерфейса: какие необязательные интеграции включены.
export const GET = api(async () => {
  await connection(); // значения зависят от окружения запуска, а не сборки
  return {
    demoMode,
    googleAuth: googleEnabled,
    paymentProvider,
    vapidPublicKey: pushEnabled ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null,
  };
});
