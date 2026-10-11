import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { matches, messages, payments, profiles, reports, sessions, users } from "@/db/schema";
import { REPORT_REASONS } from "@/lib/shared/constants";
import type { AdminReport, AdminStats } from "@/lib/shared/types";
import { badRequest, notFound } from "../errors";
import { loadPhotos } from "./cards";

const count = sql<number>`count(*)::int`;

/** Сводка для панели модератора. Демо-анкеты из сида в статистику не входят. */
export async function getAdminStats(): Promise<AdminStats> {
  const [[people], [pairs], [texts], [money], [open]] = await Promise.all([
    db
      .select({
        total: count,
        onboarded: sql<number>`count(${profiles.onboardedAt})::int`,
        premium: sql<number>`count(*) filter (where ${users.premiumUntil} > now())::int`,
        newThisWeek: sql<number>`count(*) filter (where ${users.createdAt} > now() - interval '7 days')::int`,
        banned: sql<number>`count(${users.bannedAt})::int`,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.isDemo, false)),
    db.select({ total: count }).from(matches),
    db.select({ total: count }).from(messages),
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`, purchases: count })
      .from(payments)
      .where(eq(payments.status, "succeeded")),
    db.select({ total: count }).from(reports).where(eq(reports.status, "open")),
  ]);

  return {
    users: people.total,
    onboarded: people.onboarded,
    premium: people.premium,
    newThisWeek: people.newThisWeek,
    banned: people.banned,
    matches: pairs.total,
    messages: texts.total,
    revenueMinor: money.total,
    purchases: money.purchases,
    openReports: open.total,
  };
}

export async function listOpenReports(): Promise<AdminReport[]> {
  const reporter = alias(profiles, "reporter");
  const reported = alias(profiles, "reported");

  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      details: reports.details,
      createdAt: reports.createdAt,
      reporterName: reporter.name,
      reportedId: reports.reportedId,
      reportedName: reported.name,
      reportedBio: reported.bio,
      // Сколько всего жалоб на этого человека — помогает отличить случайную от системной
      totalAgainst: sql<number>`(select count(*)::int from ${reports} r where r.reported_id = ${reports.reportedId})`,
    })
    .from(reports)
    .leftJoin(reporter, eq(reporter.userId, reports.reporterId))
    .leftJoin(reported, eq(reported.userId, reports.reportedId))
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  const photosByUser = await loadPhotos([...new Set(rows.map((r) => r.reportedId))]);
  const reasonLabel = new Map<string, string>(REPORT_REASONS.map((r) => [r.id, r.label]));

  return rows.map((r) => ({
    id: r.id,
    reason: reasonLabel.get(r.reason) ?? r.reason,
    details: r.details,
    createdAt: r.createdAt.toISOString(),
    reporterName: r.reporterName ?? "—",
    reported: {
      id: r.reportedId,
      name: r.reportedName ?? "Без анкеты",
      bio: r.reportedBio ?? "",
      photo: photosByUser.get(r.reportedId)?.[0] ?? null,
      totalReports: r.totalAgainst,
    },
  }));
}

/**
 * Решение по жалобе. «ban» блокирует аккаунт, завершает его сессии
 * и закрывает все открытые жалобы на этого пользователя.
 */
export async function resolveReport(reportId: string, action: "dismiss" | "ban") {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) throw notFound("Жалоба не найдена");

  if (action === "dismiss") {
    await db.update(reports).set({ status: "dismissed" }).where(eq(reports.id, reportId));
    return;
  }

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, report.reportedId))
    .limit(1);
  if (target?.role === "admin") throw badRequest("Администратора заблокировать нельзя");

  await db.transaction(async (tx) => {
    await tx.update(users).set({ bannedAt: new Date() }).where(eq(users.id, report.reportedId));
    await tx.delete(sessions).where(eq(sessions.userId, report.reportedId));
    await tx
      .update(reports)
      .set({ status: "resolved" })
      .where(and(eq(reports.reportedId, report.reportedId), eq(reports.status, "open")));
  });
}
