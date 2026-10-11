import { requireUser } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { listPayments } from "@/lib/server/services/billing";

export const GET = api(async () => ({ payments: await listPayments((await requireUser()).id) }));
