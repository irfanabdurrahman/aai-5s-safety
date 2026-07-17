"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/actions/findings";
import type { ActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input, FieldError } from "@/components/ui/Input";

export function CommentForm({ findingId }: { findingId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addComment,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="findingId" value={findingId} />
      <div className="flex gap-2">
        <Input
          name="body"
          placeholder="Tulis komentar…"
          maxLength={500}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Kirim"}
        </Button>
      </div>
      <FieldError message={state.error} />
    </form>
  );
}
