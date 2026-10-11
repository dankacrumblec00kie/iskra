import { requireUser } from "@/lib/server/auth/session";
import { api, uuidParam } from "@/lib/server/http";
import { cancelPayment, confirmDemoPayment, getPaymentStatus } from "@/lib/server/services/billing";

type Ctx = RouteContext<"/api/billing/payments/[id]">;

export const GET = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  return getPaymentStatus(uuidParam((await ctx.params).id), user.id);
});

// Подтверждение оплаты в тестовой кассе (PAYMENT_PROVIDER=demo)
export const POST = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const id = uuidParam((await ctx.params).id);
  await confirmDemoPayment(id, user.id);
  return getPaymentStatus(id, user.id);
});

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  await cancelPayment(uuidParam((await ctx.params).id), user.id);
  return { ok: true };
});
