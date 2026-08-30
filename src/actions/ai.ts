"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeAiBaseUrl,
  testAiConnection,
} from "@/lib/ai";

export type AiActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const settingsSchema = z.object({
  isEnabled: z.boolean(),
  provider: z.enum(["DEEPSEEK", "OPENAI_COMPATIBLE"]),
  baseUrl: z.string().trim().min(1).max(500),
  model: z.string().trim().min(2, "Nama model wajib diisi").max(120),
  apiKeyEnvVar: z.enum(["DEEPSEEK_API_KEY", "OPENAI_API_KEY", "AI_API_KEY"]),
  reasoningEffort: z.enum(["low", "high", "max"]),
  enableThinking: z.boolean(),
  maxOutputTokens: z.coerce.number().int().min(256).max(65536),
  systemPrompt: z.string().trim().max(4000).optional(),
});

export async function saveAiSettings(
  _previous: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  void _previous;
  await requireUser(["ADMIN"]);
  const parsed = settingsSchema.safeParse({
    isEnabled: formData.get("isEnabled") === "on",
    provider: formData.get("provider"),
    baseUrl: formData.get("baseUrl"),
    model: formData.get("model"),
    apiKeyEnvVar: formData.get("apiKeyEnvVar"),
    reasoningEffort: formData.get("reasoningEffort"),
    enableThinking: formData.get("enableThinking") === "on",
    maxOutputTokens: formData.get("maxOutputTokens"),
    systemPrompt: formData.get("systemPrompt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let baseUrl: string;
  try {
    baseUrl = normalizeAiBaseUrl(parsed.data.baseUrl);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Base URL tidak valid",
    };
  }

  await prisma.aiSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...parsed.data,
      baseUrl,
      systemPrompt: parsed.data.systemPrompt || null,
    },
    update: {
      ...parsed.data,
      baseUrl,
      systemPrompt: parsed.data.systemPrompt || null,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/ai");
  revalidatePath("/asisten-ai");
  return { ok: true, message: "Konfigurasi AI tersimpan." };
}

export async function testSavedAiSettings(
  _previous: AiActionState,
  _formData: FormData,
): Promise<AiActionState> {
  void _previous;
  void _formData;
  await requireUser(["ADMIN"]);
  try {
    const model = await testAiConnection();
    return { ok: true, message: `Koneksi model ${model} berhasil.` };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Konfigurasi AI tidak dapat diuji.",
    };
  }
}
