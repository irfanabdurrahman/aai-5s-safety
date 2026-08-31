import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  streamSafetyAssistant,
  type SafetyAssistantStreamEvent,
} from "@/lib/ai";

export const maxDuration = 240;

const requestSchema = z.object({
  conversationId: z.string().cuid().optional(),
  message: z.string().trim().min(2).max(4000),
});

const PUBLIC_ERROR_PREFIXES = [
  "Tulis pertanyaan",
  "AI Safety Assistant sedang",
  "Terlalu banyak pertanyaan",
  "Percakapan tidak ditemukan",
  "Layanan AI",
  "Kredensial LLM",
  "Batas penggunaan LLM",
  "Format streaming",
  "AI tidak mengembalikan jawaban",
] as const;

function publicErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    PUBLIC_ERROR_PREFIXES.some((prefix) => error.message.startsWith(prefix))
  ) {
    return error.message;
  }
  return "AI Safety Assistant gagal memproses pertanyaan. Coba lagi sebentar.";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi tidak valid. Silakan masuk kembali." }, { status: 401 });

  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Pesan tidak valid. Maksimal 4.000 karakter." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const iterator = streamSafetyAssistant({
    user,
    conversationId: payload.data.conversationId,
    question: payload.data.message,
    signal: request.signal,
  })[Symbol.asyncIterator]();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Melewati ambang buffering browser/proxy tertentu agar status pertama
      // benar-benar terlihat segera. Baris kosong ini diabaikan parser klien.
      controller.enqueue(encoder.encode(`${" ".repeat(1024)}\n`));
    },
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (error) {
        const event = {
          type: "error",
          message: publicErrorMessage(error),
        } satisfies SafetyAssistantStreamEvent | {
          type: "error";
          message: string;
        };
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-store, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
