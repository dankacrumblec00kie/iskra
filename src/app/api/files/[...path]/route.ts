import fs from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { resolveUploadPath } from "@/lib/server/storage";

// Раздаёт файлы локального хранилища (STORAGE_DRIVER=local).
// Имена файлов — случайные UUID и никогда не перезаписываются, поэтому кэш «навсегда».
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[...path]">) {
  const { path } = await ctx.params;
  const full = resolveUploadPath(path.join("/"));
  if (!full || !full.endsWith(".webp")) return new NextResponse(null, { status: 404 });

  try {
    const data = await fs.readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
