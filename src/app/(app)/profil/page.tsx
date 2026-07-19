import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/rbac";
import { Initials } from "@/components/ui/Initials";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await requireUser();
  const [reported, closed] = await Promise.all([
    prisma.finding.count({ where: { reporterId: user.id } }),
    prisma.finding.count({ where: { picId: user.id, status: "CLOSED" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">Profil Saya</h1>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Initials name={user.name} size="lg" tone="solid" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{user.name}</p>
            <p className="text-sm text-muted">NPK {user.npk}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="brand">{ROLE_LABELS[user.role]}</Badge>
              {user.department && (
                <Badge tone="neutral">{user.department.name}</Badge>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-extrabold text-brand">{reported}</p>
            <p className="text-xs font-semibold text-muted">Temuan dilaporkan</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-2xl font-extrabold text-ok">{closed}</p>
            <p className="text-xs font-semibold text-muted">
              Perbaikan selesai (PIC)
            </p>
          </CardBody>
        </Card>
      </div>

      {user.mustChangePassword && (
        <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
          Demi keamanan, silakan ganti password bawaan admin di bawah ini.
        </div>
      )}

      <Card>
        <CardHeader title="Ganti Password" />
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>

      <LogoutButton />
    </div>
  );
}
