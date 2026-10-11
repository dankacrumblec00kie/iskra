import { api } from "@/lib/server/http";
import { handleYookassaWebhook } from "@/lib/server/services/billing";

// Уведомления ЮKassa. Запрос приходит с её серверов без наших cookie, поэтому
// проверка Origin отключена; подлинность гарантирует перепроверка платежа через API.
export const POST = api(
  async (req) => {
    await handleYookassaWebhook(await req.json().catch(() => null));
    return { ok: true };
  },
  { csrf: false },
);
