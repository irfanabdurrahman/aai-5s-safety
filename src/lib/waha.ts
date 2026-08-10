/* Helper tipis untuk WAHA (WhatsApp HTTP API, self-hosted).
 *  Env: WAHA_BASE_URL (mis. http://waha:3000), WAHA_API_KEY (opsional),
 *  WA_GROUP_ID (id grup tujuan, mis. 12036xxxxx@g.us). */
import "server-only";

function baseUrl(): string | null {
  return process.env.WAHA_BASE_URL?.replace(/\/$/, "") || null;
}

function authHeaders(): Record<string, string> {
  const key = process.env.WAHA_API_KEY;
  return key ? { "X-Api-Key": key } : {};
}

/** Unduh media dari URL yang diberikan webhook WAHA (bisa relatif). */
export async function downloadMedia(url: string): Promise<{ data: Buffer; mime: string } | null> {
  const base = baseUrl();
  if (!base) return null;
  const abs = url.startsWith("http") ? url : `${base}${url}`;
  const res = await fetch(abs, { headers: authHeaders(), signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  return { data: Buffer.from(await res.arrayBuffer()), mime };
}

/** Kirim pesan teks ke grup/chat. Gagal → false (tidak melempar). */
export async function sendText(chatId: string, body: string): Promise<boolean> {
  const base = baseUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        session: process.env.WAHA_SESSION ?? "default",
        chatId,
        text: body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
