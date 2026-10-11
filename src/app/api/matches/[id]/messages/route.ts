import { requireUser } from "@/lib/server/auth/session";
import { badRequest } from "@/lib/server/errors";
import { api, readJson, uuidParam } from "@/lib/server/http";
import { getThread, sendMessage } from "@/lib/server/services/matches";
import { messageSchema } from "@/lib/shared/validation";

type Ctx = RouteContext<"/api/matches/[id]/messages">;

function dateParam(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Некорректная дата");
  return date;
}

// ?after=ISO — только новые сообщения (опрос), ?before=ISO — история выше
export const GET = api<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const params = req.nextUrl.searchParams;
  return getThread(uuidParam((await ctx.params).id), user.id, {
    after: dateParam(params.get("after")),
    before: dateParam(params.get("before")),
  });
});

export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { body } = await readJson(req, messageSchema);
  return sendMessage(uuidParam((await ctx.params).id), user.id, body);
});
