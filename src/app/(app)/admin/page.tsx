import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/Card";
import {
  IconUsers,
  IconBuilding,
  IconChecklist,
  IconCalendar,
  IconDownload,
  IconChevronRight,
} from "@/components/icons";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireUser(["ADMIN"]);
  const [users, departments, areas, templates, schedules] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.area.count({ where: { isActive: true } }),
    prisma.checklistTemplate.count({ where: { isActive: true } }),
    prisma.auditSchedule.count({ where: { isActive: true } }),
  ]);

  const items = [
    {
      href: "/admin/pengguna",
      icon: <IconUsers size={22} />,
      title: "Kelola Pengguna",
      desc: `${users} pengguna aktif`,
    },
    {
      href: "/admin/departemen",
      icon: <IconBuilding size={22} />,
      title: "Departemen, Area & Line",
      desc: `${departments} departemen · ${areas} area`,
    },
    {
      href: "/admin/checklist",
      icon: <IconChecklist size={22} />,
      title: "Checklist 5S",
      desc: `${templates} template aktif`,
    },
    {
      href: "/admin/jadwal-audit",
      icon: <IconCalendar size={22} />,
      title: "Jadwal Audit",
      desc: `${schedules} jadwal aktif`,
    },
    {
      href: "/admin/laporan",
      icon: <IconDownload size={22} />,
      title: "Laporan & Export",
      desc: "Unduh CSV temuan, audit, leaderboard",
    },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Admin EHS</h1>
        <p className="text-sm text-muted">Kelola master data & laporan.</p>
      </div>
      <div className="space-y-3">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  {it.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{it.title}</p>
                  <p className="text-xs text-muted">{it.desc}</p>
                </div>
                <IconChevronRight size={18} className="text-muted" />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
