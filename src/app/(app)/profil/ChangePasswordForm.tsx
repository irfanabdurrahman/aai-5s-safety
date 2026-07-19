"use client";

import { useActionState } from "react";
import { changePassword, type ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="current">Password lama</Label>
        <Input id="current" name="current" type="password" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="next">Password baru</Label>
          <Input id="next" name="next" type="password" minLength={6} required />
        </div>
        <div>
          <Label htmlFor="confirm">Ulangi password baru</Label>
          <Input id="confirm" name="confirm" type="password" required />
        </div>
      </div>
      <FieldError message={state.error} />
      {state.ok && (
        <p className="text-xs font-semibold text-ok">Password berhasil diganti.</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Password"}
      </Button>
    </form>
  );
}
