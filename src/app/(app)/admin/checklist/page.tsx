import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChecklistManager } from "./ChecklistManager";

export const metadata: Metadata = { title: "Checklist 5S" };

export default async function ChecklistPage() {
  await requireUser(["ADMIN"]);
  const template = await prisma.checklistTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Checklist 5S</h1>
        <p className="text-sm text-muted">
          Kriteria penilaian audit per pilar. Skala skor 0–4 per kriteria.
        </p>
      </div>
      {template ? (
        <ChecklistManager
          template={{ id: template.id, name: template.name }}
          criteria={template.criteria}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-line py-14 text-center text-sm font-semibold text-muted">
          Belum ada template. Jalankan seed database dulu.
        </p>
      )}
    </div>
  );
}
