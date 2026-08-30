import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { askSafetyAssistant } from "@/lib/ai";

export const maxDuration = 240;

const requestSchema = z.object({
  conversationId: z.string().cuid().optional(),
  message: z.string().trim().min(2).max(4000),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi tidak valid. Silakan masuk kembali." }, { status: 401 });

  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Pesan tidak valid. Maksimal 4.000 karakter." }, { status: 400 });
  }

  try {
    const result = await askSafetyAssistant({
      user,
      conversationId: payload.data.conversationId,
      question: payload.data.message,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Safety Assistant gagal memproses pertanyaan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
