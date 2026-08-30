"use client";

import { useActionState } from "react";
import {
  saveAiSettings,
  testSavedAiSettings,
  type AiActionState,
} from "@/actions/ai";
import type { AiSettingsValue } from "@/lib/ai";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/Input";

function Result({ state }: { state: AiActionState }) {
  if (state.error) return <FieldError message={state.error} />;
  return state.message ? (
    <p className="text-xs font-semibold text-ok">{state.message}</p>
  ) : null;
}

export function AiSettingsForm({
  settings,
  keyConfigured,
}: {
  settings: AiSettingsValue;
  keyConfigured: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState<AiActionState, FormData>(
    saveAiSettings,
    {},
  );
  const [testState, testAction, testing] = useActionState<AiActionState, FormData>(
    testSavedAiSettings,
    {},
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Provider OpenAI-compatible"
          subtitle="DeepSeek reasoning maksimum aktif sebagai konfigurasi awal."
        />
        <CardBody>
          <form action={saveAction} className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl bg-brand-soft px-3.5 py-3">
              <input
                name="isEnabled"
                type="checkbox"
                defaultChecked={settings.isEnabled}
                className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
              />
              <span>
                <span className="block text-sm font-bold">Aktifkan AI Safety Assistant</span>
                <span className="block text-xs text-muted">Riwayat tetap tersimpan bila layanan dinonaktifkan.</span>
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Select id="provider" name="provider" defaultValue={settings.provider}>
                  <option value="DEEPSEEK">DeepSeek</option>
                  <option value="OPENAI_COMPATIBLE">OpenAI-compatible lainnya</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" defaultValue={settings.model} required />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="baseUrl">Base URL API</Label>
                <Input id="baseUrl" name="baseUrl" type="url" defaultValue={settings.baseUrl} required />
                <p className="mt-1 text-[11px] text-muted">Gunakan endpoint HTTPS publik; boleh berupa base URL atau URL lengkap /chat/completions.</p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="apiKeyEnvVar">Sumber API key</Label>
                <Select id="apiKeyEnvVar" name="apiKeyEnvVar" defaultValue={settings.apiKeyEnvVar}>
                  <option value="DEEPSEEK_API_KEY">DEEPSEEK_API_KEY</option>
                  <option value="OPENAI_API_KEY">OPENAI_API_KEY</option>
                  <option value="AI_API_KEY">AI_API_KEY</option>
                </Select>
                <p className={`mt-1 text-xs font-semibold ${keyConfigured ? "text-ok" : "text-danger"}`}>
                  {keyConfigured ? "Secret tersedia di server." : "Secret belum tersedia di server."} Nilai key tidak ditampilkan atau disimpan dari browser.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-line p-3.5 sm:grid-cols-2">
              <label className="flex items-start gap-3 sm:col-span-2">
                <input
                  name="enableThinking"
                  type="checkbox"
                  defaultChecked={settings.enableThinking}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
                />
                <span>
                  <span className="block text-sm font-bold">Thinking/reasoning DeepSeek</span>
                  <span className="block text-xs text-muted">Matikan bila provider yang dipilih tidak mendukung parameter thinking.</span>
                </span>
              </label>
              <div>
                <Label htmlFor="reasoningEffort">Reasoning effort</Label>
                <Select id="reasoningEffort" name="reasoningEffort" defaultValue={settings.reasoningEffort}>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="max">Max — paling tinggi</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxOutputTokens">Maksimum output token</Label>
                <Input
                  id="maxOutputTokens"
                  name="maxOutputTokens"
                  type="number"
                  min={256}
                  max={65536}
                  defaultValue={settings.maxOutputTokens}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="systemPrompt">Instruksi tambahan perusahaan</Label>
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                maxLength={4000}
                defaultValue={settings.systemPrompt ?? ""}
                placeholder="Contoh: selalu prioritaskan hierarchy of controls…"
              />
            </div>

            <Result state={saveState} />
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan konfigurasi"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Uji koneksi" subtitle="Pengujian menggunakan konfigurasi yang terakhir disimpan." />
        <CardBody className="space-y-3">
          <p className="rounded-xl bg-warn-soft px-3.5 py-3 text-xs leading-relaxed text-warn">
            Pertanyaan dan potongan data Safety5S yang relevan dikirim ke provider LLM terpilih. Pastikan sesuai kebijakan data perusahaan.
          </p>
          <form action={testAction} className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" disabled={testing || !keyConfigured}>
              {testing ? "Menguji…" : "Uji koneksi tersimpan"}
            </Button>
            <Result state={testState} />
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
