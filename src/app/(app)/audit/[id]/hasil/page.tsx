import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FindingCard } from "@/components/findings/FindingCard";
import { FINDING_CARD_SELECT } from "@/components/findings/finding-card-select";
import { PILLAR_META, PILLAR_ORDER, formatDate, scoreBand } from "@/lib/labels";
import { PillarRadar } from "./PillarRadar";

export const metadata: Metadata = { title: "Hasil Audit" };

export default async function AuditHasilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      area: { include: { department: true } },
      auditor: { select: { name: true } },
      template: true,
      scores: { include: { criterion: true } },
      findings: { select: FINDING_CARD_SELECT },
    },
  });
  if (!audit || audit.status !== "SUBMITTED") notFound();
  if (!(user.role === "ADMIN" || audit.auditorId === user.id || (user.role === "SUPERVISOR" && user.departmentId === audit.area.departmentId))) notFound();

  // Skor rata-rata per pilar (skala 0..4 → persen)
  const perPillar = PILLAR_ORDER.map((p) => {
    const scores = audit.scores.filter((s) => s.criterion.pillar === p);
    const pct = scores.length
      ? (scores.reduce((sum, s) => sum + s.score, 0) / (scores.length * 4)) * 100
      : 0;
    return { pillar: p, label: PILLAR_META[p].label, pct };
  });

  const lowScores = audit.scores
    .filter((s) => s.score <= 2)
    .sort((a, b) => a.score - b.score);

  const score = audit.totalScore ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted">
          <Link href="/audit" className="text-brand">
            Audit 5S
          </Link>{" "}
          / Hasil
        </p>
        <h1 className="text-xl font-extrabold">{audit.area.name}</h1>
        <p className="text-sm text-muted">
          {audit.area.department.name} · {formatDate(audit.submittedAt)} ·
          Auditor {audit.auditor.name}
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="text-center">
            <p className={`text-5xl font-extrabold ${scoreBand(score).text}`}>
              {score.toFixed(0)}%
            </p>
            <p className="mt-1 text-xs font-bold text-muted">
              Skor 5S keseluruhan
            </p>
            <Badge tone={scoreBand(score).tone} className="mt-2">
              {scoreBand(score).label}
            </Badge>
          </div>
          <div className="flex-1">
            <PillarRadar data={perPillar} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Skor per Pilar" />
        <CardBody className="space-y-2.5">
          {perPillar.map((p) => (
            <div key={p.pillar} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-bold">{p.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full ${scoreBand(p.pct).bg}`}
                  style={{ width: `${p.pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-extrabold">
                {p.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {lowScores.length > 0 && (
        <Card>
          <CardHeader
            title="Kriteria Skor Rendah"
            subtitle="Skor ≤ 2 — perlu perhatian"
          />
          <CardBody className="space-y-2">
            {lowScores.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-xl bg-background px-3.5 py-2.5"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white ${
                    s.score <= 1 ? "bg-danger" : "bg-warn"
                  }`}
                >
                  {s.score}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.criterion.text}</p>
                  <p className="text-[11px] text-muted">
                    {PILLAR_META[s.criterion.pillar].label}
                    {s.note && ` — ${s.note}`}
                  </p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Temuan dari Audit Ini (${audit.findings.length})`}
          subtitle="Masuk ke workflow tindak lanjut"
        />
        <CardBody>
          {audit.findings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              Tidak ada temuan. 👍
            </p>
          ) : (
            <div className="space-y-3">
              {audit.findings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {audit.notes && (
        <Card>
          <CardHeader title="Catatan Auditor" />
          <CardBody>
            <p className="text-sm">{audit.notes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
