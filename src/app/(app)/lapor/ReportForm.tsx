"use client";

import { useActionState, useState } from "react";
import { createSafetyReport } from "@/actions/findings";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import {
  Input,
  Label,
  Select,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import { PhotoCapture } from "@/components/findings/PhotoCapture";
import { CATEGORY_META, RISK_META } from "@/lib/labels";
import type { RiskLevel, SafetyCategory } from "@/generated/prisma/enums";

type AreaOption = {
  id: string;
  name: string;
  departmentName: string;
  lines: { id: string; name: string }[];
};

const CATEGORIES = Object.keys(CATEGORY_META) as SafetyCategory[];
const RISKS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as RiskLevel[];

export function ReportForm({
  areas,
  defaultAreaId,
}: {
  areas: AreaOption[];
  defaultAreaId?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSafetyReport,
    {},
  );
  const [category, setCategory] = useState<SafetyCategory>("UNSAFE_CONDITION");
  const [risk, setRisk] = useState<RiskLevel>("MEDIUM");
  const [areaId, setAreaId] = useState(defaultAreaId ?? "");

  const lines = areas.find((a) => a.id === areaId)?.lines ?? [];

  return (
    <form action={action}>
      <Card>
        <CardBody className="space-y-5">
          <PhotoCapture label="Foto kondisi bahaya" required />

          <input type="hidden" name="safetyCategory" value={category} />
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Kategori temuan</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-xl border px-2 py-2.5 text-center text-xs font-bold transition-colors ${
                    category === c
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {CATEGORY_META[c].short}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {CATEGORY_META[category].label}
            </p>
          </div>

          <input type="hidden" name="riskLevel" value={risk} />
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Tingkat risiko</p>
            <div className="grid grid-cols-4 gap-2">
              {RISKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  className={`rounded-xl border px-1 py-2.5 text-center text-xs font-bold transition-colors ${
                    risk === r
                      ? r === "CRITICAL" || r === "HIGH"
                        ? "border-danger bg-danger-soft text-danger"
                        : "border-brand bg-brand-soft text-brand"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {RISK_META[r].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="areaId">Area lokasi</Label>
            <Select
              id="areaId"
              name="areaId"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              required
            >
              <option value="" disabled>
                Pilih area…
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.departmentName} — {a.name}
                </option>
              ))}
            </Select>
          </div>

          {lines.length > 0 && (
            <div>
              <Label htmlFor="lineId">Line (opsional)</Label>
              <Select id="lineId" name="lineId" defaultValue="">
                <option value="">Semua / bukan di line tertentu</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="locationDetail">Detail lokasi (opsional)</Label>
            <Input
              id="locationDetail"
              name="locationDetail"
              placeholder="Contoh: dekat mesin CNC-03, pintu masuk gudang"
              maxLength={160}
            />
          </div>

          <div>
            <Label htmlFor="description">Jelaskan temuannya</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Apa bahayanya? Apa yang kamu lihat? Contoh: Oli tercecer di lantai jalur forklift, licin dan berisiko terpeleset."
              minLength={10}
              maxLength={1000}
              required
            />
          </div>

          <FieldError message={state.error} />
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Mengirim…" : "Kirim Laporan"}
          </Button>
        </CardBody>
      </Card>
    </form>
  );
}
