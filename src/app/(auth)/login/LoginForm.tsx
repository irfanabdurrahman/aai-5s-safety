"use client";

import { useActionState } from "react";
import { login, type ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    login,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {returnTo && <input type="hidden" name="return" value={returnTo} />}
      <div>
        <Label htmlFor="npk">NPK</Label>
        <Input
          id="npk"
          name="npk"
          inputMode="numeric"
          autoComplete="username"
          placeholder="Contoh: 10001"
          required
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
