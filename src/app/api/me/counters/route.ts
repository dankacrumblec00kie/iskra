import { requireUser } from "@/lib/server/auth/session";
import { api } from "@/lib/server/http";
import { getCounters } from "@/lib/server/services/profile";

export const GET = api(async () => getCounters((await requireUser()).id));
