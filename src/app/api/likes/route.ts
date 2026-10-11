import { requireUser } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { getIncomingLikes } from "@/lib/server/services/likes";

export const GET = api(async () => getIncomingLikes(await requireUser()));
