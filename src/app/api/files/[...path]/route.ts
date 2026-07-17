import { NextResponse, type NextRequest } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import { verifySession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/session";
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
  // Foto hanya untuk user login — kecuali TV kiosk dengan token valid
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const tvToken = request.nextUrl.searchParams.get("token");
  const tvOk = !!process.env.TV_TOKEN && tvToken === process.env.TV_TOKEN;
  if (!session && !tvOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: parts } = await params;
  const rel = parts.join("/");
  const abs = resolveUploadPath(rel);
  if (!abs || !existsSync(abs) || !statSync(abs).isFile()) {
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
    },
  });
}
