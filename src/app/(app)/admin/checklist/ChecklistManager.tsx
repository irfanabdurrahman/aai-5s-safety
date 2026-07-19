"use client";

import { useActionState, useState } from "react";
import {
  addCriterion,
  updateCriterion,
  toggleCriterion,
} from "@/actions/checklist";
import type { ActionState } from "@/actions/auth";
import type { FiveSPillar } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, FieldError } from "@/components/ui/Input";
import { PILLAR_META, PILLAR_ORDER } from "@/lib/labels";

type Criterion = {
  id: string;
  pillar: FiveSPillar;
  text: string;
  isActive: boolean;
};

function AddForm({
  templateId,
  pillar,
}: {
  templateId: string;
  pillar: FiveSPillar;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addCriterion,
    {},
  );
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="pillar" value={pillar} />
      <Input
        name="text"
        placeholder={`Kriteria ${PILLAR_META[pillar].label} baru…`}
        required
        minLength={5}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Tambah"}
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}

function EditRow({
  criterion,
  onDone,
}: {
  criterion: Criterion;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await updateCriterion(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    {},
  );
  return (
    <form action={action} className="flex flex-1 gap-2">
      <input type="hidden" name="id" value={criterion.id} />
      <Input name="text" defaultValue={criterion.text} required minLength={5} />
      <Button type="submit" size="sm" disabled={pending}>
        Simpan
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}

export function ChecklistManager({
  template,
  criteria,
}: {
  template: { id: string; name: string };
  criteria: Criterion[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {PILLAR_ORDER.map((pillar) => {
        const items = criteria.filter((c) => c.pillar === pillar);
        const meta = PILLAR_META[pillar];
        return (
          <Card key={pillar}>
            <CardHeader
              title={`${meta.label} (${meta.jp})`}
              subtitle={meta.desc}
              action={<Badge tone="brand">{items.filter((c) => c.isActive).length} aktif</Badge>}
            />
            <CardBody className="space-y-2.5">
              {items.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  {editing === c.id ? (
                    <EditRow criterion={c} onDone={() => setEditing(null)} />
                  ) : (
                    <>
                      <p
                        className={`min-w-0 flex-1 text-sm ${
                          c.isActive ? "" : "text-muted line-through"
                        }`}
                      >
                        {c.text}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(c.id)}
                      >
                        Edit
                      </Button>
                      <form action={toggleCriterion}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button
                          size="sm"
                          variant="ghost"
                          type="submit"
                          className={c.isActive ? "text-danger" : "text-ok"}
                        >
                          {c.isActive ? "Nonaktif" : "Aktifkan"}
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              ))}
              <AddForm templateId={template.id} pillar={pillar} />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
