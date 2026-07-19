"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  saveScore,
  createAuditFinding,
  submitAudit,
  type AuditFindingState,
} from "@/actions/audits";
import type { ActionState } from "@/actions/auth";
import type { FiveSPillar } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Textarea, FieldError } from "@/components/ui/Input";
import { PhotoCapture } from "@/components/findings/PhotoCapture";
import { PILLAR_META } from "@/lib/labels";
import { IconChevronDown } from "@/components/icons";

type Criterion = { id: string; text: string; pillar: FiveSPillar };
type PillarGroup = { pillar: FiveSPillar; criteria: Criterion[] };
type ScoreMap = Record<string, { score: number; note: string | null }>;

const SCORE_LABEL = ["0", "1", "2", "3", "4"];
const SCORE_HINT =
  "0 = sangat buruk · 2 = perlu perbaikan · 4 = sesuai standar";

function FindingMiniForm({
  auditId,
  criterion,
  onDone,
}: {
  auditId: string;
  criterion: Criterion;
  onDone: (num: string) => void;
}) {
  const [state, action, pending] = useActionState<AuditFindingState, FormData>(
    async (prev, fd) => {
      const res = await createAuditFinding(prev, fd);
      if (res.ok && res.findingNumber) onDone(res.findingNumber);
      return res;
    },
    {},
  );

  return (
    <form
      action={action}
      className="mt-3 space-y-3 rounded-xl border border-danger/30 bg-danger-soft/40 p-3.5"
    >
      <input type="hidden" name="auditId" value={auditId} />
      <input type="hidden" name="criterionId" value={criterion.id} />
      <p className="text-xs font-bold text-danger">
        Jadikan temuan — akan masuk daftar tindak lanjut
      </p>
      <PhotoCapture label="Foto kondisi (opsional)" />
      <Textarea
        name="description"
        defaultValue={`${criterion.text} — belum sesuai standar.`}
        minLength={10}
        maxLength={1000}
        required
      />
      <FieldError message={state.error} />
      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Temuan"}
      </Button>
    </form>
  );
}

function CriterionCard({
  auditId,
  criterion,
  value,
  findingNumber,
  onScore,
}: {
  auditId: string;
  criterion: Criterion;
  value?: { score: number; note: string | null };
  findingNumber?: string;
  onScore: (criterionId: string, score: number) => void;
}) {
  const [showFinding, setShowFinding] = useState(false);
  const [localFinding, setLocalFinding] = useState<string | null>(null);
  const num = localFinding ?? findingNumber;
  const low = value !== undefined && value.score <= 2;

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <p className="text-sm font-medium leading-snug">{criterion.text}</p>
      <div className="mt-2.5 grid grid-cols-5 gap-1.5">
        {SCORE_LABEL.map((label, s) => (
          <button
            key={s}
            type="button"
            onClick={() => onScore(criterion.id, s)}
            className={`h-10 rounded-lg text-sm font-extrabold transition-colors ${
              value?.score === s
                ? s <= 2
                  ? "bg-danger text-white"
                  : "bg-ok text-white"
                : "bg-background text-muted hover:bg-line"
            }`}
            aria-pressed={value?.score === s}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted">{SCORE_HINT}</p>

      {low && !num && (
        <div className="mt-2">
          {showFinding ? (
            <FindingMiniForm
              auditId={auditId}
              criterion={criterion}
              onDone={(n) => {
                setLocalFinding(n);
                setShowFinding(false);
              }}
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-danger"
              onClick={() => setShowFinding(true)}
            >
              + Jadikan Temuan
            </Button>
          )}
        </div>
      )}
      {num && (
        <div className="mt-2">
          <Badge tone="danger">Temuan {num}</Badge>
        </div>
      )}
    </div>
  );
}

export function ChecklistRunner({
  audit,
  pillars,
  initialScores,
  findings,
}: {
  audit: {
    id: string;
    areaName: string;
    departmentName: string;
    templateName: string;
  };
  pillars: PillarGroup[];
  initialScores: { criterionId: string; score: number; note: string | null }[];
  findings: { id: string; number: string; criterionId: string | null }[];
}) {
  const [scores, setScores] = useState<ScoreMap>(() =>
    Object.fromEntries(
      initialScores.map((s) => [s.criterionId, { score: s.score, note: s.note }]),
    ),
  );
  const [openPillar, setOpenPillar] = useState<FiveSPillar | null>(
    pillars[0]?.pillar ?? null,
  );
  const [, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | undefined>();
  const [submitState, submitAction, submitPending] = useActionState<
    ActionState,
    FormData
  >(submitAudit, {});

  const totalCriteria = pillars.reduce((s, p) => s + p.criteria.length, 0);
  const scoredCount = Object.keys(scores).length;
  const runningScore = useMemo(() => {
    const vals = Object.values(scores);
    if (!vals.length) return null;
    return (
      (vals.reduce((s, v) => s + v.score, 0) / (totalCriteria * 4)) * 100
    );
  }, [scores, totalCriteria]);

  const findingByCriterion = Object.fromEntries(
    findings.filter((f) => f.criterionId).map((f) => [f.criterionId!, f.number]),
  );

  function handleScore(criterionId: string, score: number) {
    setScores((prev) => ({
      ...prev,
      [criterionId]: { score, note: prev[criterionId]?.note ?? null },
    }));
    // Autosave langsung per kriteria — tahan koneksi putus
    startTransition(async () => {
      const fd = new FormData();
      fd.set("auditId", audit.id);
      fd.set("criterionId", criterionId);
      fd.set("score", String(score));
      const res = await saveScore({}, fd);
      setSaveError(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header sticky dengan progress */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:mx-0 lg:rounded-2xl lg:border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold">
              {audit.areaName}
            </h1>
            <p className="text-xs text-muted">
              {audit.departmentName} · {audit.templateName}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-xl font-extrabold ${
                runningScore === null
                  ? "text-muted"
                  : runningScore >= 80
                    ? "text-ok"
                    : runningScore >= 60
                      ? "text-warn"
                      : "text-danger"
              }`}
            >
              {runningScore === null ? "—" : `${runningScore.toFixed(0)}%`}
            </p>
            <p className="text-[10px] font-semibold text-muted">
              {scoredCount}/{totalCriteria} dinilai
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(scoredCount / totalCriteria) * 100}%` }}
          />
        </div>
        {saveError && (
          <p className="mt-1.5 text-xs font-semibold text-danger">
            Gagal menyimpan: {saveError}
          </p>
        )}
      </div>

      {/* Accordion per pilar */}
      {pillars.map((group) => {
        const meta = PILLAR_META[group.pillar];
        const scored = group.criteria.filter((c) => scores[c.id]).length;
        const open = openPillar === group.pillar;
        return (
          <Card key={group.pillar}>
            <button
              type="button"
              onClick={() => setOpenPillar(open ? null : group.pillar)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-extrabold text-brand">
                {meta.label[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">
                  {meta.label}{" "}
                  <span className="font-semibold text-muted">({meta.jp})</span>
                </span>
                <span className="block text-xs text-muted">{meta.desc}</span>
              </span>
              <Badge tone={scored === group.criteria.length ? "ok" : "neutral"}>
                {scored}/{group.criteria.length}
              </Badge>
              <IconChevronDown
                size={18}
                className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <CardBody className="space-y-3 pt-0">
                {group.criteria.map((c) => (
                  <CriterionCard
                    key={c.id}
                    auditId={audit.id}
                    criterion={c}
                    value={scores[c.id]}
                    findingNumber={findingByCriterion[c.id]}
                    onScore={handleScore}
                  />
                ))}
              </CardBody>
            )}
          </Card>
        );
      })}

      {/* Submit */}
      <Card>
        <CardBody>
          <form action={submitAction} className="space-y-3">
            <input type="hidden" name="auditId" value={audit.id} />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">
                Catatan audit (opsional)
              </p>
              <Textarea
                name="notes"
                placeholder="Catatan umum kondisi area…"
                maxLength={1000}
              />
            </div>
            <FieldError message={submitState.error} />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitPending || scoredCount < totalCriteria}
            >
              {submitPending
                ? "Mengirim…"
                : scoredCount < totalCriteria
                  ? `Nilai semua kriteria dulu (${scoredCount}/${totalCriteria})`
                  : "Selesai & Kirim Audit"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
