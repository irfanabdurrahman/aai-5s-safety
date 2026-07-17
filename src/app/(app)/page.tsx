import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FindingCard } from "@/components/findings/FindingCard";
import { IconAlert, IconCamera, IconChevronRight } from "@/components/icons";
import { canVerify } from "@/lib/rbac";

const CARD_SELECT = {
  id: true,
  number: true,
  source: true,
  status: true,
  riskLevel: true,
  safetyCategory: true,
  pillar: true,
  description: true,
  dueDate: true,
  createdAt: true,
  area: { select: { name: true, department: { select: { code: true } } } },
  reporter: { select: { name: true } },
  pic: { select: { name: true } },
  photos: {
    where: { type: "BEFORE" as const },
    take: 1,
    select: { filePath: true },
  },
} as const;

export default async function BerandaPage() {
  const user = await requireUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [myOpenReports, myTasks, verifyQueue, myAudits, recent] =
    await Promise.all([
      prisma.finding.count({
        where: { reporterId: user.id, status: { not: "CLOSED" } },
      }),
      user.role !== "KARYAWAN"
        ? prisma.finding.count({
            where: {
              picId: user.id,
              status: { in: ["IN_PROGRESS"] },
            },
          })
        : 0,
      canVerify(user.role)
        ? prisma.finding.count({
            where: {
              status: "PENDING_VERIFICATION",
              ...(user.role === "SUPERVISOR" && user.departmentId
                ? { area: { departmentId: user.departmentId } }
                : {}),
            },
          })
        : 0,
      prisma.audit.count({
        where: { auditorId: user.id, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      }),
      prisma.finding.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: CARD_SELECT,
      }),
    ]);

  const shortcuts = [
    myTasks > 0 && {
      href: "/tugas-saya",
      label: "Tugas perbaikan menunggumu",
      count: myTasks,
      tone: "warn" as const,
    },
    verifyQueue > 0 && {
      href: "/verifikasi",
      label: "Perbaikan menunggu verifikasi",
      count: verifyQueue,
      tone: "info" as const,
    },
    myAudits > 0 && {
      href: "/audit",
      label: "Audit 5S perlu dikerjakan",
      count: myAudits,
      tone: "brand" as const,
    },
    myOpenReports > 0 && {
      href: "/temuan?q=&status=",
      label: "Laporanmu masih diproses",
      count: myOpenReports,
      tone: "neutral" as const,
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    count: number;
    tone: "warn" | "info" | "brand" | "neutral";
  }[];

  const toneClass = {
    warn: "bg-warn-soft text-warn",
    info: "bg-info-soft text-info",
    brand: "bg-brand-soft text-brand",
    neutral: "bg-background text-muted",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">
          Halo, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted">
          {user.department?.name ?? "PT Akebono Brake Astra Indonesia"}
        </p>
      </div>

      {/* CTA lapor */}
      <Link href="/lapor" className="block">
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-accent to-[#a70016] p-5 text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <IconCamera size={26} />
          </span>
          <div className="flex-1">
            <p className="text-base font-extrabold">Lihat bahaya? Lapor!</p>
            <p className="text-xs text-white/80">
              Foto → kategori → kirim. Kurang dari 1 menit.
            </p>
          </div>
          <IconChevronRight size={20} className="text-white/70" />
        </div>
      </Link>

      {/* Shortcut tugas */}
      {shortcuts.length > 0 && (
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <Link
              key={s.href + s.label}
              href={s.href}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold ${toneClass[s.tone]}`}
              >
                {s.count}
              </span>
              <span className="flex-1 text-sm font-bold">{s.label}</span>
              <IconChevronRight size={17} className="text-muted" />
            </Link>
          ))}
        </div>
      )}

      {/* Feed terbaru */}
      <Card>
        <CardHeader
          title="Temuan Terbaru"
          action={
            <Link href="/temuan" className="text-xs font-bold text-brand">
              Lihat semua →
            </Link>
          }
        />
        <CardBody>
          {recent.length === 0 ? (
            <div className="py-8 text-center">
              <IconAlert size={32} className="mx-auto text-muted" />
              <p className="mt-2 text-sm font-semibold text-muted">
                Belum ada temuan. Jadilah pelapor pertama!
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recent.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
