import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FindingCard,
  type FindingCardData,
} from "@/components/findings/FindingCard";
import { FINDING_CARD_SELECT } from "@/components/findings/finding-card-select";
import { isOverdue } from "@/lib/labels";
import { wibToday, addDays } from "@/lib/dates";

export const metadata: Metadata = { title: "Tugas Saya" };

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone?: "danger" | "warn";
  items: FindingCardData[];
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2
        className={`text-sm font-extrabold ${
          tone === "danger"
            ? "text-danger"
            : tone === "warn"
              ? "text-warn"
              : "text-foreground"
        }`}
      >
        {title}{" "}
        <span className="font-semibold text-muted">({items.length})</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((f) => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </div>
    </section>
  );
}

export default async function TugasSayaPage() {
  const user = await requireUser(["PIC_AREA", "SUPERVISOR", "ADMIN"]);
  const soon = addDays(wibToday(), 3);

  const [tasks, openInMyAreas] = await Promise.all([
    prisma.finding.findMany({
      where: {
        picId: user.id,
        status: { in: ["IN_PROGRESS", "PENDING_VERIFICATION"] },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: FINDING_CARD_SELECT,
    }),
    // Temuan OPEN di area yang PIC-nya user ini (bisa "Ambil Tugas")
    user.role === "PIC_AREA"
      ? prisma.finding.findMany({
          where: { status: "OPEN", area: { picUserId: user.id } },
          orderBy: { createdAt: "desc" },
          select: FINDING_CARD_SELECT,
        })
      : Promise.resolve([]),
  ]);

  // Satu definisi overdue (isOverdue); PENDING_VERIFICATION dikelompokkan
  // terpisah karena bolanya di verifikator, bukan PIC.
  const waiting = tasks.filter((f) => f.status === "PENDING_VERIFICATION");
  const active = tasks.filter((f) => f.status === "IN_PROGRESS");
  const overdue = active.filter((f) => isOverdue(f));
  const dueSoon = active.filter(
    (f) => !isOverdue(f) && f.dueDate && f.dueDate <= soon,
  );
  const rest = active.filter(
    (f) => !overdue.includes(f) && !dueSoon.includes(f),
  );

  const empty = !tasks.length && !openInMyAreas.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold">Tugas Saya</h1>
        <p className="text-sm text-muted">
          Temuan yang jadi tanggung jawabmu sebagai PIC.
        </p>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-line py-14 text-center text-sm font-semibold text-muted">
          Tidak ada tugas aktif. Kerja bagus! 🎉
        </div>
      ) : (
        <>
          <Section title="🔴 Terlambat" tone="danger" items={overdue} />
          <Section
            title="🟠 Segera jatuh tempo (≤3 hari)"
            tone="warn"
            items={dueSoon}
          />
          <Section title="Sedang dikerjakan" items={rest} />
          <Section title="Menunggu verifikasi supervisor" items={waiting} />
          <Section
            title="🆕 Temuan baru di area kamu — bisa diambil"
            items={openInMyAreas}
          />
        </>
      )}
    </div>
  );
}
