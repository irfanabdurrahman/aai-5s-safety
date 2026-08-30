import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getAiSettings, isAiKeyConfigured } from "@/lib/ai";
import { AiSettingsForm } from "./AiSettingsForm";

export const metadata: Metadata = { title: "Konfigurasi AI & LLM" };

export default async function AiSettingsPage() {
  await requireUser(["ADMIN"]);
  const settings = await getAiSettings();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">AI &amp; LLM</h1>
        <p className="text-sm text-muted">
          Atur engine yang digunakan AI Safety Assistant.
        </p>
      </div>
      <AiSettingsForm settings={settings} keyConfigured={isAiKeyConfigured(settings)} />
    </div>
  );
}
