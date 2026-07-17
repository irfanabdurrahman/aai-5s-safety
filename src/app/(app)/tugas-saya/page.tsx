import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FindingCard, type FindingCardData } from "@/components/findings/FindingCard";

export const metadata: Metadata = { title: "Tugas Saya" };

const CARD_SELECT = {
  id: true,
  number: true,
  source: true,
  status: true,
  riskLevel: true,
  safetyCategory: true,
  pillar: true,
  description: true,
  dueDate: true,
  createdAt: true,
  area: { select: { name: true, department: { select: { code: true } } } },
  reporter: { select: { name: true } },
  pic: { select: { name: true } },
  photos: {
    where: { type: "BEFORE" as const },
    take: 1,
    select: { filePath: true },
  },
} as const;

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 3);

  const tasks = await prisma.finding.findMany({
    where: { picId: user.id, status: { in: ["IN_PROGRESS", "PENDING_VERIFICATION"] } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: CARD_SELECT,
  });

  // Temuan OPEN di area yang PIC-nya user ini (bisa "Ambil Tugas")
  const openInMyAreas =
    user.role === "PIC_AREA"
      ? await prisma.finding.findMany({
          where: { status: "OPEN", area: { picUserId: user.id } },
          orderBy: { createdAt: "desc" },
          select: CARD_SELECT,
        })
      : [];

  const overdue = tasks.filter(
    (f) => f.dueDate && f.dueDate < today && f.status !== "PENDING_VERIFICATION",
  );
  const dueSoon = tasks.filter(
    (f) =>
      f.dueDate &&
      f.dueDate >= today &&
      f.dueDate <= soon &&
      f.status !== "PENDING_VERIFICATION",
  );
  const rest = tasks.filter((f) => !overdue.includes(f) && !dueSoon.includes(f));

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
          <Section title="🟠 Segera jatuh tempo (≤3 hari)" tone="warn" items={dueSoon} />
          <Section title="Sedang dikerjakan / menunggu verifikasi" items={rest} />
          <Section title="🆕 Temuan baru di area kamu — bisa diambil" items={openInMyAreas} />
        </>
      )}
    </div>
  );
}
