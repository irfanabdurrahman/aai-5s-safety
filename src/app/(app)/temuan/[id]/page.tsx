import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/workflow";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  StatusBadge,
  RiskBadge,
  OverdueBadge,
} from "@/components/findings/StatusBadge";
import {
  CATEGORY_META,
  PILLAR_META,
  SOURCE_META,
  STATUS_META,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { Initials } from "@/components/ui/Initials";
import { FindingActions } from "./FindingActions";
import { CommentForm } from "./CommentForm";
import { PhotoGallery } from "./PhotoGallery";

export const metadata: Metadata = { title: "Detail Temuan" };

export default async function TemuanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const finding = await prisma.finding.findUnique({
    where: { id },
    include: {
      area: { include: { department: true } },
      line: true,
      reporter: { select: { id: true, name: true, npk: true } },
      pic: { select: { id: true, name: true } },
      verifiedBy: { select: { name: true } },
      criterion: { select: { text: true } },
      audit: { select: { id: true } },
      photos: { orderBy: { createdAt: "asc" } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, role: true } } },
      },
    },
  });
  if (!finding) notFound();

  const wf = {
    id: finding.id,
    number: finding.number,
    status: finding.status,
    areaId: finding.areaId,
    reporterId: finding.reporterId,
    picId: finding.picId,
    area: {
      picUserId: finding.area.picUserId,
      department: { id: finding.area.departmentId },
    },
  };

  const can = {
    assign:
      canTransition(user, wf, "IN_PROGRESS") && user.role !== "PIC_AREA",
    takeTask:
      user.role === "PIC_AREA" && canTransition(user, wf, "IN_PROGRESS"),
    complete: canTransition(user, wf, "PENDING_VERIFICATION"),
    verify:
      finding.status === "PENDING_VERIFICATION" &&
      canTransition(user, wf, "CLOSED"),
    reject:
      finding.status === "PENDING_VERIFICATION" &&
      canTransition(user, wf, "IN_PROGRESS"),
    invalidate: finding.status === "OPEN" && canTransition(user, wf, "CLOSED"),
  };

  // Backend assignment hanya menerima PIC Area aktif di departemen temuan.
  const picCandidates = can.assign
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          role: "PIC_AREA",
          departmentId: finding.area.departmentId,
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  const before = finding.photos.filter((p) => p.type === "BEFORE");
  const after = finding.photos.filter((p) => p.type === "AFTER");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-extrabold text-brand">{finding.number}</h1>
          <StatusBadge status={finding.status} />
          <OverdueBadge finding={finding} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {SOURCE_META[finding.source].label} · Dilaporkan{" "}
          {formatDateTime(finding.createdAt)} oleh {finding.reporter.name}
        </p>
      </div>

      {/* Info utama */}
      <Card>
        <CardBody className="space-y-4">
          <p className="text-[15px] leading-relaxed">{finding.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {finding.safetyCategory && (
              <Badge tone="neutral">
                {CATEGORY_META[finding.safetyCategory].label}
              </Badge>
            )}
            {finding.pillar && (
              <Badge tone="brand">
                5S · {PILLAR_META[finding.pillar].label} (
                {PILLAR_META[finding.pillar].jp})
              </Badge>
            )}
            <RiskBadge risk={finding.riskLevel} />
          </div>

          {finding.criterion && (
            <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-xs font-medium text-brand">
              Kriteria audit: {finding.criterion.text}
              {finding.audit && (
                <>
                  {" · "}
                  <Link
                    href={`/audit/${finding.audit.id}/hasil`}
                    className="underline"
                  >
                    lihat hasil audit
                  </Link>
                </>
              )}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div>
              <dt className="text-xs font-semibold text-muted">Area</dt>
              <dd className="font-semibold">
                {finding.area.name}
                {finding.line && ` · ${finding.line.name}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Departemen</dt>
              <dd className="font-semibold">{finding.area.department.name}</dd>
            </div>
            {finding.locationDetail && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-muted">
                  Detail lokasi
                </dt>
                <dd className="font-semibold">{finding.locationDetail}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold text-muted">PIC</dt>
              <dd className="font-semibold">
                {finding.pic?.name ?? (
                  <span className="text-muted">Belum ditugaskan</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">
                Target selesai
              </dt>
              <dd className="font-semibold">{formatDate(finding.dueDate)}</dd>
            </div>
            {finding.verifiedBy && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-muted">
                  Diverifikasi oleh
                </dt>
                <dd className="font-semibold">
                  {finding.verifiedBy.name} · {formatDateTime(finding.closedAt)}
                </dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Foto before/after */}
      <Card>
        <CardHeader
          title="Dokumentasi"
          subtitle={
            after.length
              ? "Perbandingan sebelum & sesudah perbaikan"
              : "Kondisi saat ditemukan"
          }
        />
        <CardBody>
          <PhotoGallery before={before} after={after} />
          {finding.actionNote && (
            <div className="mt-3 rounded-xl bg-ok-soft px-3.5 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ok">
                Tindakan perbaikan
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                {finding.actionNote}
              </p>
            </div>
          )}
          {finding.rejectionNote && finding.status === "IN_PROGRESS" && (
            <div className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-danger">
                Catatan penolakan verifikasi
              </p>
              <p className="mt-0.5 text-sm">{finding.rejectionNote}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Aksi sesuai role & status */}
      <FindingActions
        findingId={finding.id}
        can={can}
        picCandidates={picCandidates}
        riskLevel={finding.riskLevel}
        selfId={user.id}
      />

      {/* Riwayat status */}
      <Card>
        <CardHeader title="Riwayat" />
        <CardBody>
          <ol className="space-y-0">
            {finding.statusHistory.map((h, i) => (
              <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < finding.statusHistory.length - 1 && (
                  <span className="absolute left-[5px] top-4 h-full w-0.5 bg-line" />
                )}
                <span
                  className={`relative mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                    h.toStatus === "CLOSED"
                      ? "bg-ok"
                      : h.toStatus === "OPEN"
                        ? "bg-danger"
                        : "bg-brand"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {STATUS_META[h.toStatus].label}
                    <span className="ml-2 text-[11px] font-semibold text-muted">
                      {formatDateTime(h.createdAt)}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {h.actor.name}
                    {h.note && ` — ${h.note}`}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {/* Komentar */}
      <Card>
        <CardHeader
          title={`Komentar (${finding.comments.length})`}
          subtitle="Koordinasi tindak lanjut"
        />
        <CardBody className="space-y-4">
          {finding.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Initials name={c.user.name} size="sm" />
              <div className="min-w-0 flex-1 rounded-xl bg-background px-3.5 py-2.5">
                <p className="text-xs font-bold">
                  {c.user.name}
                  <span className="ml-2 font-semibold text-muted">
                    {formatDateTime(c.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-sm">{c.body}</p>
              </div>
            </div>
          ))}
          <CommentForm findingId={finding.id} />
        </CardBody>
      </Card>
    </div>
  );
}
