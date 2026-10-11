import { requireUser } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { listMatches } from "@/lib/server/services/matches";

export const GET = api(async () => ({ matches: await listMatches((await requireUser()).id) }));
