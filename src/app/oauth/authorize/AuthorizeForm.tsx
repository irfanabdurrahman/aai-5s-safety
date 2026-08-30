"use client";

import { useActionState } from "react";
import { authorizeConsent, type OAuthActionState } from "@/actions/oauth";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";

export function AuthorizeForm({
  clientId,
  redirectUri,
  codeChallenge,
  resource,
  state,
}: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  state?: string;
}) {
  const [formState, action, pending] = useActionState<
    OAuthActionState,
    FormData
  >(authorizeConsent, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="resource" value={resource} />
      {state && <input type="hidden" name="state" value={state} />}
      <div>
        <Label htmlFor="admin_password">Password Admin MCP</Label>
        <Input
          id="admin_password"
          name="admin_password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          autoFocus
        />
      </div>
      <FieldError message={formState.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Memeriksa…" : "Izinkan Akses"}
      </Button>
    </form>
  );
}
