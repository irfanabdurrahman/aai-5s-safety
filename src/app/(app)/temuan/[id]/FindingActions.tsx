"use client";

import { useActionState, useState } from "react";
import {
  assignPic,
  completeFix,
  verifyClose,
  rejectVerification,
  invalidateFinding,
} from "@/actions/findings";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Input,
  Label,
  Select,
  Textarea,
  FieldError,
} from "@/components/ui/Input";
import { PhotoCapture } from "@/components/findings/PhotoCapture";
import { RISK_DUE_DAYS } from "@/lib/labels";
import type { RiskLevel, Role } from "@/generated/prisma/enums";

type Candidate = { id: string; name: string; role: Role };

type Can = {
  assign: boolean;
  takeTask: boolean;
  complete: boolean;
  verify: boolean;
  reject: boolean;
  invalidate: boolean;
};

function defaultDueDate(risk: RiskLevel | null): string {
  const days = risk ? RISK_DUE_DAYS[risk] : 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function FindingActions({
  findingId,
  can,
  picCandidates,
  riskLevel,
  selfId,
}: {
  findingId: string;
  can: Can;
  picCandidates: Candidate[];
  riskLevel: RiskLevel | null;
  selfId: string;
}) {
  const [panel, setPanel] = useState<
    "assign" | "complete" | "verify" | "reject" | "invalidate" | null
  >(null);

  const [assignState, assignAction, assignPending] = useActionState<
    ActionState,
    FormData
  >(assignPic, {});
  const [takeState, takeAction, takePending] = useActionState<
    ActionState,
    FormData
  >(assignPic, {});
  const [completeState, completeAction, completePending] = useActionState<
    ActionState,
    FormData
  >(completeFix, {});
  const [verifyState, verifyAction, verifyPending] = useActionState<
    ActionState,
    FormData
  >(verifyClose, {});
  const [rejectState, rejectAction, rejectPending] = useActionState<
    ActionState,
    FormData
  >(rejectVerification, {});
  const [invalidState, invalidAction, invalidPending] = useActionState<
    ActionState,
    FormData
  >(invalidateFinding, {});

  const hasAction =
    can.assign || can.takeTask || can.complete || can.verify || can.reject || can.invalidate;
  if (!hasAction) return null;

  return (
    <Card className="border-brand/30">
      <CardHeader title="Tindak Lanjut" />
      <CardBody className="space-y-3">
        {/* Tombol utama */}
        <div className="flex flex-wrap gap-2">
          {can.assign && (
            <Button
              onClick={() => setPanel(panel === "assign" ? null : "assign")}
            >
              Tugaskan PIC
            </Button>
          )}
          {can.takeTask && (
            <form action={takeAction}>
              <input type="hidden" name="findingId" value={findingId} />
              <input type="hidden" name="picId" value={selfId} />
              <input
                type="hidden"
                name="dueDate"
                value={defaultDueDate(riskLevel)}
              />
              <Button type="submit" disabled={takePending}>
                {takePending ? "Memproses…" : "Ambil Tugas Ini"}
              </Button>
            </form>
          )}
          {can.complete && (
            <Button
              variant="ok"
              onClick={() => setPanel(panel === "complete" ? null : "complete")}
            >
              Selesai Perbaikan
            </Button>
          )}
          {can.verify && (
            <Button
              variant="ok"
              onClick={() => setPanel(panel === "verify" ? null : "verify")}
            >
              Terima &amp; Tutup
            </Button>
          )}
          {can.reject && (
            <Button
              variant="outline"
              className="text-danger"
              onClick={() => setPanel(panel === "reject" ? null : "reject")}
            >
              Tolak Verifikasi
            </Button>
          )}
          {can.invalidate && (
            <Button
              variant="ghost"
              className="text-muted"
              onClick={() =>
                setPanel(panel === "invalidate" ? null : "invalidate")
              }
            >
              Tutup — Tidak Valid
            </Button>
          )}
        </div>
        <FieldError message={takeState.error} />

        {/* Panel: tugaskan PIC */}
        {panel === "assign" && (
          <form
            action={assignAction}
            className="space-y-3 rounded-xl bg-background p-4"
          >
            <input type="hidden" name="findingId" value={findingId} />
            <div>
              <Label htmlFor="picId">PIC penanggung jawab</Label>
              <Select id="picId" name="picId" required defaultValue="">
                <option value="" disabled>
                  Pilih PIC…
                </option>
                {picCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role === "PIC_AREA" ? "PIC Area" : "Supervisor"})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="dueDate">Target selesai</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={defaultDueDate(riskLevel)}
                required
              />
              <p className="mt-1 text-[11px] text-muted">
                Saran otomatis berdasarkan tingkat risiko — boleh diubah.
              </p>
            </div>
            <FieldError message={assignState.error} />
            <Button type="submit" disabled={assignPending}>
              {assignPending ? "Menyimpan…" : "Tugaskan"}
            </Button>
          </form>
        )}

        {/* Panel: selesai perbaikan */}
        {panel === "complete" && (
          <form
            action={completeAction}
            className="space-y-3 rounded-xl bg-background p-4"
          >
            <input type="hidden" name="findingId" value={findingId} />
            <PhotoCapture label="Foto kondisi SESUDAH perbaikan" required />
            <div>
              <Label htmlFor="actionNote">Tindakan yang dilakukan</Label>
              <Textarea
                id="actionNote"
                name="actionNote"
                placeholder="Contoh: Oli dibersihkan, dipasang drip pan di bawah mesin, area diberi tanda."
                minLength={10}
                maxLength={1000}
                required
              />
            </div>
            <FieldError message={completeState.error} />
            <Button type="submit" variant="ok" disabled={completePending}>
              {completePending ? "Mengirim…" : "Kirim untuk Verifikasi"}
            </Button>
          </form>
        )}

        {/* Panel: verifikasi terima */}
        {panel === "verify" && (
          <form
            action={verifyAction}
            className="space-y-3 rounded-xl bg-background p-4"
          >
            <input type="hidden" name="findingId" value={findingId} />
            <div>
              <Label htmlFor="note">Catatan verifikasi (opsional)</Label>
              <Input
                id="note"
                name="note"
                placeholder="Contoh: Sudah dicek langsung di lokasi, OK."
                maxLength={500}
              />
            </div>
            <FieldError message={verifyState.error} />
            <Button type="submit" variant="ok" disabled={verifyPending}>
              {verifyPending ? "Menyimpan…" : "Konfirmasi: Terima & Tutup"}
            </Button>
          </form>
        )}

        {/* Panel: tolak verifikasi */}
        {panel === "reject" && (
          <form
            action={rejectAction}
            className="space-y-3 rounded-xl bg-background p-4"
          >
            <input type="hidden" name="findingId" value={findingId} />
            <div>
              <Label htmlFor="rejectNote">Alasan penolakan</Label>
              <Textarea
                id="rejectNote"
                name="note"
                placeholder="Jelaskan kenapa perbaikan belum bisa diterima…"
                minLength={5}
                maxLength={500}
                required
              />
            </div>
            <FieldError message={rejectState.error} />
            <Button type="submit" variant="danger" disabled={rejectPending}>
              {rejectPending ? "Menyimpan…" : "Tolak — Kembalikan ke PIC"}
            </Button>
          </form>
        )}

        {/* Panel: tutup tidak valid */}
        {panel === "invalidate" && (
          <form
            action={invalidAction}
            className="space-y-3 rounded-xl bg-background p-4"
          >
            <input type="hidden" name="findingId" value={findingId} />
            <div>
              <Label htmlFor="invalidNote">Alasan (wajib)</Label>
              <Textarea
                id="invalidNote"
                name="note"
                placeholder="Contoh: Duplikat dari SF-2026-0012 / bukan temuan valid."
                minLength={5}
                maxLength={500}
                required
              />
            </div>
            <FieldError message={invalidState.error} />
            <Button type="submit" variant="danger" disabled={invalidPending}>
              {invalidPending ? "Menyimpan…" : "Tutup Temuan"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
