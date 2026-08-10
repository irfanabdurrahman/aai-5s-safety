import { NextResponse, type NextRequest } from "next/server";
import { createFindingFromIntake } from "@/lib/intake";
import { downloadMedia, sendText } from "@/lib/waha";
import { INTAKE_KEYWORD } from "@/lib/area-map";

/** Struktur payload webhook WAHA (event "message") yang kita pakai. */
interface WaWebhook {
  event?: string;
  payload?: {
    id?: string;
    from?: string;
    fromMe?: boolean;
    body?: string;
    caption?: string;
    hasMedia?: boolean;
    mimetype?: string;
    mediaUrl?: string;
    media?: { url?: string; mimetype?: string };
  };
}

/** Webhook intake dari WAHA: pesan gambar di grup whitelist dengan caption
 *  ber-keyword (temuan/safety/5S/dst) otomatis menjadi temuan baru.
 *  Selalu balas 200 ke WAHA supaya tidak terjadi retry berulang. */
export async function POST(request: NextRequest) {
  const secret = process.env.WA_INTAKE_SECRET;
  if (!secret || request.headers.get("x-intake-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WaWebhook;
  try {
    body = (await request.json()) as WaWebhook;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" });
  }

  // Hanya event pesan baru
  if (body?.event !== "message" || !body?.payload) {
    return NextResponse.json({ ok: true, skipped: "bukan event message" });
  }
  const p = body.payload;

  // Hanya dari grup yang di-whitelist, bukan pesan bot sendiri
  const groupId = process.env.WA_GROUP_ID;
  if (!p.from || p.fromMe || (groupId && p.from !== groupId)) {
    return NextResponse.json({ ok: true, skipped: "bukan dari grup target" });
  }
  const chatId = p.from;

  const caption: string = (p.body ?? p.caption ?? "").trim();
  if (!INTAKE_KEYWORD.test(caption)) {
    return NextResponse.json({ ok: true, skipped: "tanpa keyword temuan" });
  }

  // Wajib ada media gambar
  const mediaUrl: string | undefined = p.media?.url ?? p.mediaUrl;
  const mime: string | undefined = p.media?.mimetype ?? p.mimetype;
  if (!mediaUrl || (mime && !mime.startsWith("image/"))) {
    return NextResponse.json({ ok: true, skipped: "tanpa foto" });
  }

  const photo = await downloadMedia(mediaUrl);
  if (!photo) {
    console.error("[intake-wa] gagal unduh media:", mediaUrl);
    return NextResponse.json({ ok: false, reason: "gagal unduh media" });
  }

  const result = await createFindingFromIntake({
    description: caption,
    areaText: caption,
    photos: [photo],
    reporterNpk: "WA-BOT",
  });

  if (result.ok) {
    await sendText(
      chatId,
      `✅ Temuan *${result.number}* tercatat di area *${result.areaName}* (status: Terbuka).\n` +
        `_${caption.slice(0, 120)}_\nTindak lanjut via aplikasi safety5s.`,
    );
    return NextResponse.json({ ok: true, number: result.number });
  }

  console.error("[intake-wa] gagal buat temuan:", result.error);
  await sendText(chatId, `⚠️ Temuan gagal tercatat: ${result.error}`);
  return NextResponse.json({ ok: false, reason: result.error });
}
