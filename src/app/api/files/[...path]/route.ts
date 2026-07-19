import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { apiUser, isTvAuthorized } from "@/lib/api-auth";
import { resolveUploadPath } from "@/lib/upload";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Foto hanya untuk user aktif — kecuali TV kiosk dengan token valid
  const user = await apiUser(request);
  const tvOk = await isTvAuthorized(request);
  if (!user && !tvOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: parts } = await params;
  const rel = parts.join("/");
  const abs = await resolveUploadPath(rel);
  if (!abs) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const stream = Readable.toWeb(
    createReadStream(abs),
  ) as ReadableStream<Uint8Array>;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="photo.${ext || "bin"}"`,
    },
  });
}
