"use client";

import { useActionState, useState } from "react";
import { createSchedule } from "@/actions/checklist";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";

export function ScheduleForm({
  areas,
  auditors,
}: {
  areas: { id: string; name: string }[];
  auditors: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSchedule,
    {},
  );
  const [freq, setFreq] = useState("WEEKLY");

  return (
    <Card>
      <CardHeader title="Buat Jadwal Baru" />
      <CardBody>
        <form action={action} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Area</Label>
              <Select name="areaId" required defaultValue="">
                <option value="" disabled>
                  Pilih area…
                </option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Auditor</Label>
              <Select name="auditorId" required defaultValue="">
                <option value="" disabled>
                  Pilih auditor…
                </option>
                {auditors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Frekuensi</Label>
              <Select
                name="frequency"
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
              >
                <option value="WEEKLY">Mingguan</option>
                <option value="MONTHLY">Bulanan</option>
                <option value="ONCE">Sekali saja</option>
              </Select>
            </div>
            {freq === "WEEKLY" && (
              <div>
                <Label>Hari</Label>
                <Select name="dayOfWeek" defaultValue="1">
                  {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(
                    (d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ),
                  )}
                </Select>
              </div>
            )}
            {freq === "MONTHLY" && (
              <div>
                <Label>Tanggal (1–28)</Label>
                <Input
                  name="dayOfMonth"
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={1}
                />
              </div>
            )}
            <div>
              <Label>Mulai</Label>
              <Input
                name="startDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>
          <FieldError message={state.error} />
          {state.ok && (
            <p className="text-xs font-semibold text-ok">
              Jadwal dibuat — audit pertama sudah muncul di daftar auditor.
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Buat Jadwal"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
