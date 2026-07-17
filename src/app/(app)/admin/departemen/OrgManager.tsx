"use client";

import { useActionState, useState } from "react";
import {
  saveDepartment,
  saveArea,
  saveLine,
  toggleEntityActive,
} from "@/actions/admin";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";

type Dept = { id: string; code: string; name: string; isActive: boolean };
type AreaRow = {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  picUserId: string | null;
  isActive: boolean;
  department: { name: string };
  picUser: { name: string } | null;
};
type LineRow = {
  id: string;
  name: string;
  areaId: string;
  isActive: boolean;
  area: { name: string };
};
type Candidate = { id: string; name: string };

type Tab = "departemen" | "area" | "line";

function ToggleButton({
  id,
  kind,
  isActive,
}: {
  id: string;
  kind: string;
  isActive: boolean;
}) {
  return (
    <form action={toggleEntityActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <Button
        size="sm"
        variant="ghost"
        type="submit"
        className={isActive ? "text-danger" : "text-ok"}
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>
    </form>
  );
}

function DeptTab({ departments }: { departments: Dept[] }) {
  const [editing, setEditing] = useState<Dept | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveDepartment,
    {},
  );
  return (
    <div className="space-y-4">
      <form
        key={editing?.id ?? "new"}
        action={action}
        className="space-y-3 rounded-xl bg-background p-4"
      >
        <p className="text-sm font-bold">
          {editing ? `Edit: ${editing.name}` : "Tambah Departemen"}
        </p>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <div>
            <Label>Kode</Label>
            <Input name="code" defaultValue={editing?.code} placeholder="DISC" required />
          </div>
          <div>
            <Label>Nama</Label>
            <Input name="name" defaultValue={editing?.name} placeholder="Produksi Disc Brake" required />
          </div>
        </div>
        <FieldError message={state.error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
          )}
        </div>
      </form>
      <div className="divide-y divide-line">
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-3 py-2.5">
            <Badge tone="brand">{d.code}</Badge>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {d.name} {!d.isActive && <Badge tone="danger">Nonaktif</Badge>}
            </p>
            <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
              Edit
            </Button>
            <ToggleButton id={d.id} kind="department" isActive={d.isActive} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaTab({
  areas,
  departments,
  picCandidates,
}: {
  areas: AreaRow[];
  departments: Dept[];
  picCandidates: Candidate[];
}) {
  const [editing, setEditing] = useState<AreaRow | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveArea,
    {},
  );
  return (
    <div className="space-y-4">
      <form
        key={editing?.id ?? "new"}
        action={action}
        className="space-y-3 rounded-xl bg-background p-4"
      >
        <p className="text-sm font-bold">
          {editing ? `Edit: ${editing.name}` : "Tambah Area"}
        </p>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <div>
            <Label>Kode</Label>
            <Input name="code" defaultValue={editing?.code} placeholder="DISC-L1" required />
          </div>
          <div>
            <Label>Nama</Label>
            <Input name="name" defaultValue={editing?.name} placeholder="Line Disc Brake 1" required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Departemen</Label>
            <Select name="departmentId" defaultValue={editing?.departmentId ?? ""} required>
              <option value="" disabled>
                Pilih…
              </option>
              {departments
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>PIC default area</Label>
            <Select name="picUserId" defaultValue={editing?.picUserId ?? ""}>
              <option value="">— Tanpa PIC default —</option>
              {picCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FieldError message={state.error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
          )}
        </div>
      </form>
      <div className="divide-y divide-line">
        {areas.map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {a.name} {!a.isActive && <Badge tone="danger">Nonaktif</Badge>}
              </p>
              <p className="text-xs text-muted">
                {a.code} · {a.department.name} · PIC:{" "}
                {a.picUser?.name ?? "—"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
              Edit
            </Button>
            <ToggleButton id={a.id} kind="area" isActive={a.isActive} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LineTab({ lines, areas }: { lines: LineRow[]; areas: AreaRow[] }) {
  const [editing, setEditing] = useState<LineRow | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveLine,
    {},
  );
  return (
    <div className="space-y-4">
      <form
        key={editing?.id ?? "new"}
        action={action}
        className="space-y-3 rounded-xl bg-background p-4"
      >
        <p className="text-sm font-bold">
          {editing ? `Edit: ${editing.name}` : "Tambah Line"}
        </p>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nama line</Label>
            <Input name="name" defaultValue={editing?.name} placeholder="Line 1A" required />
          </div>
          <div>
            <Label>Area</Label>
            <Select name="areaId" defaultValue={editing?.areaId ?? ""} required>
              <option value="" disabled>
                Pilih…
              </option>
              {areas
                .filter((a) => a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
        </div>
        <FieldError message={state.error} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
          )}
        </div>
      </form>
      <div className="divide-y divide-line">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center gap-3 py-2.5">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {l.name}{" "}
              <span className="text-xs font-normal text-muted">
                · {l.area.name}
              </span>{" "}
              {!l.isActive && <Badge tone="danger">Nonaktif</Badge>}
            </p>
            <Button size="sm" variant="outline" onClick={() => setEditing(l)}>
              Edit
            </Button>
            <ToggleButton id={l.id} kind="line" isActive={l.isActive} />
          </div>
        ))}
        {!lines.length && (
          <p className="py-6 text-center text-sm text-muted">
            Belum ada line. Line bersifat opsional (sub-lokasi dalam area).
          </p>
        )}
      </div>
    </div>
  );
}

export function OrgManager({
  departments,
  areas,
  lines,
  picCandidates,
}: {
  departments: Dept[];
  areas: AreaRow[];
  lines: LineRow[];
  picCandidates: Candidate[];
}) {
  const [tab, setTab] = useState<Tab>("departemen");
  const tabs: { key: Tab; label: string }[] = [
    { key: "departemen", label: `Departemen (${departments.length})` },
    { key: "area", label: `Area (${areas.length})` },
    { key: "line", label: `Line (${lines.length})` },
  ];

  return (
    <Card>
      <CardHeader title="Master Data Lokasi" />
      <CardBody className="space-y-4">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                tab === t.key
                  ? "bg-brand text-white"
                  : "border border-line bg-surface text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "departemen" && <DeptTab departments={departments} />}
        {tab === "area" && (
          <AreaTab
            areas={areas}
            departments={departments}
            picCandidates={picCandidates}
          />
        )}
        {tab === "line" && <LineTab lines={lines} areas={areas} />}
      </CardBody>
    </Card>
  );
}
