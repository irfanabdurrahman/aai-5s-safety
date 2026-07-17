import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toggleSchedule } from "@/actions/checklist";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScheduleForm } from "./ScheduleForm";
import { formatDate } from "@/lib/labels";

export const metadata: Metadata = { title: "Jadwal Audit" };

const FREQ_LABEL = { WEEKLY: "Mingguan", MONTHLY: "Bulanan", ONCE: "Sekali" };
const DAY_LABEL = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default async function JadwalAuditPage() {
  await requireUser(["ADMIN"]);
  const [schedules, areas, auditors] = await Promise.all([
    prisma.auditSchedule.findMany({
      orderBy: [{ isActive: "desc" }, { startDate: "asc" }],
      include: {
        area: { select: { name: true } },
        auditor: { select: { name: true } },
      },
    }),
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["PIC_AREA", "SUPERVISOR", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Jadwal Audit 5S</h1>
        <p className="text-sm text-muted">
          Audit dibuat otomatis sesuai frekuensi; auditor dapat notifikasi.
        </p>
      </div>

      <ScheduleForm areas={areas} auditors={auditors} />

      <Card>
        <CardHeader title={`Jadwal (${schedules.length})`} />
        <CardBody>
          {schedules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Belum ada jadwal audit.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {s.area.name}{" "}
                      {!s.isActive && <Badge tone="danger">Nonaktif</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {FREQ_LABEL[s.frequency]}
                      {s.frequency === "WEEKLY" && s.dayOfWeek
                        ? ` · ${DAY_LABEL[s.dayOfWeek]}`
                        : ""}
                      {s.frequency === "MONTHLY" && s.dayOfMonth
                        ? ` · tgl ${s.dayOfMonth}`
                        : ""}{" "}
                      · Auditor {s.auditor.name} · mulai {formatDate(s.startDate)}
                    </p>
                  </div>
                  <form action={toggleSchedule}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button
                      size="sm"
                      variant="ghost"
                      type="submit"
                      className={s.isActive ? "text-danger" : "text-ok"}
                    >
                      {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
