"use client";

import { useActionState, useState } from "react";
import {
  createUser,
  updateUser,
  toggleUserActive,
  resetPassword,
} from "@/actions/admin";
import type { ActionState } from "@/actions/auth";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { ROLE_LABELS } from "@/lib/rbac";
import { IconPlus, IconSearch } from "@/components/icons";

type UserRow = {
  id: string;
  npk: string;
  name: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  department: { name: string } | null;
};

type Dept = { id: string; name: string };

const ROLES = Object.keys(ROLE_LABELS) as Role[];

function RoleFields({
  departments,
  defaults,
}: {
  departments: Dept[];
  defaults?: Partial<UserRow>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>Nama lengkap</Label>
        <Input name="name" defaultValue={defaults?.name} required />
      </div>
      <div>
        <Label>Role</Label>
        <Select name="role" defaultValue={defaults?.role ?? "KARYAWAN"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label>Departemen</Label>
        <Select
          name="departmentId"
          defaultValue={defaults?.departmentId ?? ""}
          required
        >
          <option value="" disabled>
            Pilih departemen…
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function CreateForm({ departments }: { departments: Dept[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createUser,
    {},
  );
  return (
    <Card>
      <CardHeader title="Tambah Pengguna" />
      <CardBody>
        <form action={action} className="space-y-3">
          <div>
            <Label>NPK</Label>
            <Input name="npk" placeholder="Contoh: 41023" required />
          </div>
          <RoleFields departments={departments} />
          <FieldError message={state.error} />
          {state.ok && (
            <p className="text-xs font-semibold text-ok">
              Pengguna berhasil ditambahkan.
            </p>
          )}
          <Button type="submit" disabled={pending}>
            <IconPlus size={16} />
            {pending ? "Menyimpan…" : "Tambah"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function EditForm({
  user,
  departments,
  onDone,
}: {
  user: UserRow;
  departments: Dept[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateUser,
    {},
  );
  return (
    <form action={action} className="space-y-3 rounded-xl bg-background p-4">
      <input type="hidden" name="id" value={user.id} />
      <RoleFields departments={departments} defaults={user} />
      <FieldError message={state.error} />
      {state.ok && (
        <p className="text-xs font-semibold text-ok">Tersimpan.</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Tutup
        </Button>
      </div>
    </form>
  );
}

export function UserManager({
  users,
  departments,
}: {
  users: UserRow[];
  departments: Dept[];
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = users.filter(
    (u) =>
      !q ||
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.npk.includes(q),
  );

  return (
    <div className="space-y-4">
      <CreateForm departments={departments} />

      <Card>
        <CardHeader title={`Daftar Pengguna (${users.length})`} />
        <CardBody className="space-y-3">
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama atau NPK…"
              className="pl-9"
            />
          </div>

          <div className="divide-y divide-line">
            {filtered.map((u) => (
              <div key={u.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {u.name}{" "}
                      {!u.isActive && <Badge tone="danger">Nonaktif</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      NPK {u.npk} · {ROLE_LABELS[u.role]} ·{" "}
                      {u.department?.name ?? "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing(editing === u.id ? null : u.id)
                      }
                    >
                      Edit
                    </Button>
                    <form action={resetPassword}>
                      <input type="hidden" name="id" value={u.id} />
                      <Button size="sm" variant="ghost" type="submit">
                        Reset PW
                      </Button>
                    </form>
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <Button
                        size="sm"
                        variant="ghost"
                        type="submit"
                        className={u.isActive ? "text-danger" : "text-ok"}
                      >
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </form>
                  </div>
                </div>
                {editing === u.id && (
                  <div className="mt-3">
                    <EditForm
                      user={u}
                      departments={departments}
                      onDone={() => setEditing(null)}
                    />
                  </div>
                )}
              </div>
            ))}
            {!filtered.length && (
              <p className="py-6 text-center text-sm text-muted">
                Tidak ada pengguna yang cocok.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
