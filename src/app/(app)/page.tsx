import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FindingCard } from "@/components/findings/FindingCard";
import { FINDING_CARD_SELECT } from "@/components/findings/finding-card-select";
import {
  IconAlert,
  IconCamera,
  IconChevronRight,
  IconChecklist,
  IconClipboard,
  IconTrophy,
  IconChart,
  IconCheckSquare,
  IconTv,
} from "@/components/icons";
import { canVerify, canViewDashboard } from "@/lib/rbac";

export default async function BerandaPage() {
  const user = await requireUser();

  const [myOpenReports, myTasks, verifyQueue, myAudits, recent] =
    await Promise.all([
      prisma.finding.count({
        where: { reporterId: user.id, status: { not: "CLOSED" } },
      }),
      user.role !== "KARYAWAN"
        ? prisma.finding.count({
            where: { picId: user.id, status: { in: ["IN_PROGRESS"] } },
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
        where: {
          auditorId: user.id,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
      }),
      prisma.finding.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: FINDING_CARD_SELECT,
      }),
    ]);

  // Tile menu ala portal — berwarna, role-aware
  const tiles = [
    {
      href: "/temuan",
      label: "Daftar Temuan",
      icon: <IconClipboard size={26} />,
      cls: "tile-indigo",
      badge: myOpenReports || undefined,
    },
    {
      href: "/audit",
      label: "Audit 5S",
      icon: <IconChecklist size={26} />,
      cls: "tile-green",
      badge: myAudits || undefined,
    },
    ...(myTasks > 0 || user.role === "PIC_AREA"
      ? [
          {
            href: "/tugas-saya",
            label: "Tugas Saya",
            icon: <IconCheckSquare size={26} />,
            cls: "tile-orange",
            badge: myTasks || undefined,
          },
        ]
      : []),
    ...(canVerify(user.role)
      ? [
          {
            href: "/verifikasi",
            label: "Verifikasi",
            icon: <IconAlert size={26} />,
            cls: "tile-blue",
            badge: verifyQueue || undefined,
          },
        ]
      : []),
    {
      href: "/leaderboard",
      label: "Peringkat",
      icon: <IconTrophy size={26} />,
      cls: "tile-teal",
    },
    ...(canViewDashboard(user.role)
      ? [
          {
            href: "/dashboard",
            label: "Dashboard",
            icon: <IconChart size={26} />,
            cls: "tile-indigo",
          },
          {
            href: "/galeri",
            label: "Galeri Temuan",
            icon: <IconTv size={26} />,
            cls: "tile-green",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
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
        <div className="tile-red flex items-center gap-4 rounded-2xl p-5 text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <IconCamera size={26} />
          </span>
          <div className="flex-1">
            <p className="text-base font-extrabold">Lihat bahaya? Lapor!</p>
            <p className="text-xs text-white/85">
              Foto → kategori → kirim. Kurang dari 1 menit.
            </p>
          </div>
          <IconChevronRight size={20} className="text-white/80" />
        </div>
      </Link>

      {/* Tile menu berwarna ala portal */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href + t.label}
            href={t.href}
            className={`${t.cls} relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-white shadow-md transition-transform active:scale-95 sm:aspect-[4/3]`}
          >
            {t.badge !== undefined && (
              <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-accent shadow">
                {t.badge}
              </span>
            )}
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
              {t.icon}
            </span>
            <span className="text-[11px] font-bold leading-tight sm:text-xs">
              {t.label}
            </span>
          </Link>
        ))}
      </div>

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
