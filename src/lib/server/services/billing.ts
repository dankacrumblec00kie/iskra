import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, profiles, users } from "@/db/schema";
import { PRODUCT_BY_ID } from "@/lib/shared/products";
import { appUrl } from "../auth/google";
import { badRequest, forbidden, notFound } from "../errors";
import { notify } from "./notifications";

/**
 * Платежи. Провайдер выбирается переменной PAYMENT_PROVIDER:
 *  - demo     — встроенная тестовая касса: деньги не списываются, оплата
 *               подтверждается кнопкой. Для защиты проекта и разработки.
 *  - yookassa — ЮKassa (API v3). Нужны YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY.
 *
 * Доступ выдаётся в одном месте — fulfillPayment — и только один раз на платёж.
 */
export type PaymentProvider = "demo" | "yookassa";

export const paymentProvider: PaymentProvider =
  process.env.PAYMENT_PROVIDER === "yookassa" ? "yookassa" : "demo";

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function yookassaAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) throw new Error("Не заданы YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY");
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
}

type YooPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amount: { value: string; currency: string };
  confirmation?: { confirmation_url?: string };
  metadata?: { paymentId?: string };
};

export async function createCheckout(userId: string, productId: string, origin?: string) {
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) throw badRequest("Неизвестный тариф");

  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      provider: paymentProvider,
      productId: product.id,
      amountMinor: product.priceMinor,
    })
    .returning();

  if (paymentProvider === "demo") {
    return { paymentId: payment.id, url: `/premium/checkout/${payment.id}` };
  }

  const response = await fetch(`${YOOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      authorization: yookassaAuth(),
      "content-type": "application/json",
      // Ключ идемпотентности: повтор запроса не создаст второй платёж
      "idempotence-key": payment.id,
    },
    body: JSON.stringify({
      amount: { value: (product.priceMinor / 100).toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${appUrl(origin)}/premium/checkout/${payment.id}`,
      },
      description: `Искра — ${product.title}`,
      metadata: { paymentId: payment.id },
    }),
  });
  if (!response.ok) {
    console.error("[billing] ЮKassa отклонила создание платежа:", response.status, await response.text());
    throw new Error("Платёжный сервис недоступен");
  }
  const remote = (await response.json()) as YooPayment;

  await db
    .update(payments)
    .set({ providerPaymentId: remote.id })
    .where(eq(payments.id, payment.id));

  return { paymentId: payment.id, url: remote.confirmation?.confirmation_url ?? "/premium" };
}

/**
 * Выдаёт оплаченное. Идемпотентно: статус меняется условным UPDATE,
 * поэтому повторный вебхук или двойной клик не продлят подписку дважды.
 */
export async function fulfillPayment(paymentId: string) {
  const fulfilled = await db.transaction(async (tx) => {
    const [payment] = await tx
      .update(payments)
      .set({ status: "succeeded", paidAt: new Date() })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
      .returning();
    if (!payment) return null;

    const product = PRODUCT_BY_ID.get(payment.productId);
    if (!product) throw new Error(`Платёж ${paymentId}: неизвестный товар ${payment.productId}`);

    if (product.kind === "premium") {
      // Продление отсчитывается от конца текущей подписки, если она ещё активна
      await tx
        .update(users)
        .set({
          premiumUntil: sql`greatest(coalesce(${users.premiumUntil}, now()), now()) + make_interval(days => ${product.amount})`,
        })
        .where(eq(users.id, payment.userId));
    } else {
      await tx
        .update(profiles)
        .set({
          boostedUntil: sql`greatest(coalesce(${profiles.boostedUntil}, now()), now()) + make_interval(mins => ${product.amount})`,
        })
        .where(eq(profiles.userId, payment.userId));
    }
    return { payment, product };
  });

  if (fulfilled) {
    await notify({
      userId: fulfilled.payment.userId,
      type: fulfilled.product.kind,
      payload: { productId: fulfilled.product.id, title: fulfilled.product.title },
    });
  }
  return fulfilled !== null;
}

async function getOwnPayment(paymentId: string, userId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)))
    .limit(1);
  if (!payment) throw notFound("Платёж не найден");
  return payment;
}

/** Сверяет статус платежа с ЮKassa. Источник правды — её API, а не тело вебхука. */
async function syncWithYookassa(payment: typeof payments.$inferSelect) {
  if (!payment.providerPaymentId || payment.status !== "pending") return;

  const response = await fetch(`${YOOKASSA_API}/payments/${payment.providerPaymentId}`, {
    headers: { authorization: yookassaAuth() },
  });
  if (!response.ok) return;
  const remote = (await response.json()) as YooPayment;

  const paidInFull =
    remote.status === "succeeded" &&
    remote.amount.currency === payment.currency &&
    Math.round(Number(remote.amount.value) * 100) === payment.amountMinor;

  if (paidInFull) await fulfillPayment(payment.id);
  else if (remote.status === "canceled") {
    await db
      .update(payments)
      .set({ status: "canceled" })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
  }
}

/** Статус платежа для страницы оплаты; для ЮKassa заодно подтягивает актуальный. */
export async function getPaymentStatus(paymentId: string, userId: string) {
  let payment = await getOwnPayment(paymentId, userId);
  if (payment.provider === "yookassa" && payment.status === "pending") {
    await syncWithYookassa(payment);
    payment = await getOwnPayment(paymentId, userId);
  }
  const product = PRODUCT_BY_ID.get(payment.productId);
  return {
    id: payment.id,
    status: payment.status,
    provider: payment.provider as PaymentProvider,
    amountMinor: payment.amountMinor,
    product: product ? { id: product.id, kind: product.kind, title: product.title } : null,
  };
}

/** Подтверждение в тестовой кассе. В режиме ЮKassa этот путь закрыт. */
export async function confirmDemoPayment(paymentId: string, userId: string) {
  const payment = await getOwnPayment(paymentId, userId);
  if (paymentProvider !== "demo" || payment.provider !== "demo") {
    throw forbidden("Тестовая оплата отключена");
  }
  await fulfillPayment(payment.id);
}

export async function cancelPayment(paymentId: string, userId: string) {
  await getOwnPayment(paymentId, userId);
  await db
    .update(payments)
    .set({ status: "canceled" })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")));
}

/** Вебхук ЮKassa: телу не доверяем, берём из него только id и перепроверяем через API. */
export async function handleYookassaWebhook(body: unknown) {
  const remoteId = (body as { object?: { id?: unknown } })?.object?.id;
  if (typeof remoteId !== "string") return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.provider, "yookassa"), eq(payments.providerPaymentId, remoteId)))
    .limit(1);
  if (payment) await syncWithYookassa(payment);
}

export async function listPayments(userId: string) {
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "succeeded")))
    .orderBy(desc(payments.createdAt))
    .limit(20);
  return rows.map((p) => ({
    id: p.id,
    title: PRODUCT_BY_ID.get(p.productId)?.title ?? p.productId,
    amountMinor: p.amountMinor,
    paidAt: p.paidAt?.toISOString() ?? null,
  }));
}
