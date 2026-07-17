import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PILLAR_ORDER } from "@/lib/labels";
import { ChecklistRunner } from "./ChecklistRunner";

export const metadata: Metadata = { title: "Isi Checklist Audit" };

export default async function AuditRunPage({
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
      template: {
        include: {
          criteria: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      },
      scores: true,
      findings: { select: { id: true, number: true, criterionId: true } },
    },
  });
  if (!audit) notFound();
  if (audit.status === "SUBMITTED") redirect(`/audit/${id}/hasil`);
  if (audit.auditorId !== user.id && user.role !== "ADMIN") redirect("/audit");

  const pillars = PILLAR_ORDER.map((p) => ({
    pillar: p,
    criteria: audit.template.criteria.filter((c) => c.pillar === p),
  })).filter((g) => g.criteria.length > 0);

  return (
    <ChecklistRunner
      audit={{
        id: audit.id,
        areaName: audit.area.name,
        departmentName: audit.area.department.name,
        templateName: audit.template.name,
      }}
      pillars={pillars}
      initialScores={audit.scores.map((s) => ({
        criterionId: s.criterionId,
        score: s.score,
        note: s.note,
      }))}
      findings={audit.findings}
    />
  );
}
