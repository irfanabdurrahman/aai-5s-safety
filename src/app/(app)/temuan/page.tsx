import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { FindingStatus } from "@/generated/prisma/enums";
import { FindingCard } from "@/components/findings/FindingCard";
import { FINDING_CARD_SELECT } from "@/components/findings/finding-card-select";
import { Input, Select } from "@/components/ui/Input";
import { STATUS_META } from "@/lib/labels";
import { IconSearch } from "@/components/icons";

export const metadata: Metadata = { title: "Daftar Temuan" };

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "Semua" },
  { key: "OPEN", label: STATUS_META.OPEN.label },
  { key: "IN_PROGRESS", label: STATUS_META.IN_PROGRESS.label },
  { key: "PENDING_VERIFICATION", label: STATUS_META.PENDING_VERIFICATION.label },
  { key: "CLOSED", label: STATUS_META.CLOSED.label },
  { key: "overdue", label: "Terlambat" },
];

const PAGE_SIZE = 20;

export default async function TemuanPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    area?: string;
    source?: string;
    q?: string;
    hal?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.hal ?? "1", 10) || 1);

  const where: Prisma.FindingWhereInput = {};
  if (sp.status === "overdue") {
    where.status = { not: "CLOSED" };
    where.dueDate = { lt: new Date() };
  } else if (sp.status && sp.status in STATUS_META) {
    where.status = sp.status as FindingStatus;
  }
  if (sp.area) where.areaId = sp.area;
  if (sp.source === "SAFETY_REPORT" || sp.source === "AUDIT_5S") {
    where.source = sp.source;
  }
  if (sp.q) {
    where.OR = [
      { description: { contains: sp.q, mode: "insensitive" } },
      { number: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const [findings, total, areas] = await Promise.all([
    prisma.finding.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: FINDING_CARD_SELECT,
    }),
    prisma.finding.count({ where }),
    prisma.area.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/temuan?${s}` : "/temuan";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Daftar Temuan</h1>
        <span className="text-xs font-semibold text-muted">{total} temuan</span>
      </div>

      {/* Tab status */}
      <div className="scroll-x -mx-4 flex gap-2 px-4">
        {STATUS_TABS.map((t) => {
          const active = (sp.status ?? "") === t.key;
          return (
            <Link
              key={t.key}
              href={qs({ status: t.key || undefined, hal: undefined })}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold ${
                active
                  ? "bg-brand text-white"
                  : "border border-line bg-surface text-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Pencarian & filter */}
      <form className="flex gap-2" action="/temuan" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <div className="relative flex-1">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            name="q"
            defaultValue={sp.q}
            placeholder="Cari nomor atau deskripsi…"
            className="pl-9"
          />
        </div>
        <Select name="area" defaultValue={sp.area ?? ""} className="w-36">
          <option value="">Semua area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={sp.source ?? ""} className="w-32">
          <option value="">Semua sumber</option>
          <option value="SAFETY_REPORT">Safety</option>
          <option value="AUDIT_5S">Audit 5S</option>
        </Select>
        <button type="submit" className="sr-only">
          Cari
        </button>
      </form>

      {/* Daftar */}
      {findings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-14 text-center">
          <p className="text-sm font-semibold text-muted">
            Tidak ada temuan yang cocok.
          </p>
          <Link
            href="/lapor"
            className="mt-2 inline-block text-sm font-bold text-brand"
          >
            Lapor temuan baru →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-sm font-semibold">
          {page > 1 && (
            <Link href={qs({ hal: String(page - 1) })} className="text-brand">
              ← Sebelumnya
            </Link>
          )}
          <span className="text-muted">
            Hal {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={qs({ hal: String(page + 1) })} className="text-brand">
              Berikutnya →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
