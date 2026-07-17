"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Select, FieldError } from "@/components/ui/Input";
import { IconPlus } from "@/components/icons";

export function AdhocAuditForm({
  areas,
  action,
}: {
  areas: { id: string; name: string }[];
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <IconPlus size={16} />
        Mulai Audit Ad-hoc
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="min-w-48 flex-1">
        <p className="mb-1.5 text-[13px] font-semibold">Area yang diaudit</p>
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
      <Button type="submit" disabled={pending}>
        {pending ? "Menyiapkan…" : "Mulai"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Batal
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}
