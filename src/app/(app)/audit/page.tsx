import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startAudit, startAdhocAudit } from "@/actions/audits";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AUDIT_STATUS_META, formatDate, scoreBand } from "@/lib/labels";
import { AdhocAuditForm } from "./AdhocAuditForm";

export const metadata: Metadata = { title: "Audit 5S" };

export default async function AuditPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [audits, areas] = await Promise.all([
    prisma.audit.findMany({
      where: isAdmin ? {} : { auditorId: user.id },
      orderBy: [{ status: "asc" }, { scheduledDate: "desc" }],
      take: 30,
      include: {
        area: { select: { name: true } },
        auditor: { select: { name: true } },
        _count: { select: { findings: true } },
      },
    }),
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const active = audits.filter((a) => a.status !== "SUBMITTED");
  const done = audits.filter((a) => a.status === "SUBMITTED");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Audit 5S</h1>
        <p className="text-sm text-muted">
          Patrol 5S: Ringkas · Rapi · Resik · Rawat · Rajin
        </p>
      </div>

      {user.role !== "KARYAWAN" && (
        <AdhocAuditForm areas={areas} action={startAdhocAudit} />
      )}

      {active.length > 0 && (
        <Card>
          <CardHeader title="Perlu Dikerjakan" />
          <CardBody className="space-y-3">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-line p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{a.area.name}</p>
                  <p className="text-xs text-muted">
                    Jadwal {formatDate(a.scheduledDate)} · Auditor{" "}
                    {a.auditor.name}
                  </p>
                  <Badge tone={AUDIT_STATUS_META[a.status].tone}>
                    {AUDIT_STATUS_META[a.status].label}
                  </Badge>
                </div>
                {a.status === "SCHEDULED" ? (
                  <form action={startAudit}>
                    <input type="hidden" name="auditId" value={a.id} />
                    <Button type="submit" size="sm">
                      Mulai
                    </Button>
                  </form>
                ) : (
                  <Link href={`/audit/${a.id}`}>
                    <Button size="sm" variant="outline">
                      Lanjutkan
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Riwayat Audit"
          subtitle={isAdmin ? "Semua audit" : "Audit yang kamu kerjakan"}
        />
        <CardBody>
          {done.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Belum ada audit selesai.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {done.map((a) => (
                <Link
                  key={a.id}
                  href={`/audit/${a.id}/hasil`}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{a.area.name}</p>
                    <p className="text-xs text-muted">
                      {formatDate(a.submittedAt)} · {a._count.findings} temuan
                    </p>
                  </div>
                  <span
                    className={`text-lg font-extrabold ${scoreBand(a.totalScore ?? 0).text}`}
                  >
                    {a.totalScore?.toFixed(0)}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
