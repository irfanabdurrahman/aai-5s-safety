import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  StatusBadge,
  RiskBadge,
  OverdueBadge,
} from "@/components/findings/StatusBadge";
import { CATEGORY_META, PILLAR_META, formatDate } from "@/lib/labels";
import type {
  FindingStatus,
  RiskLevel,
  SafetyCategory,
  FiveSPillar,
  FindingSource,
} from "@/generated/prisma/enums";

export type FindingCardData = {
  id: string;
  number: string;
  source: FindingSource;
  status: FindingStatus;
  riskLevel: RiskLevel | null;
  safetyCategory: SafetyCategory | null;
  pillar: FiveSPillar | null;
  description: string;
  dueDate: Date | null;
  createdAt: Date;
  area: { name: string; department: { code: string } };
  reporter: { name: string };
  pic: { name: string } | null;
  photos: { filePath: string }[];
};

export function FindingCard({ finding: f }: { finding: FindingCardData }) {
  const thumb = f.photos[0];
  return (
    <Link
      href={`/temuan/${f.id}`}
      className="block rounded-2xl border border-line bg-surface p-3.5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-md"
    >
      <div className="flex gap-3">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${thumb.filePath}`}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-extrabold text-brand">{f.number}</span>
            <StatusBadge status={f.status} />
            <OverdueBadge finding={f} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
            {f.description}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="font-semibold">{f.area.name}</span>
            <span>·</span>
            <span>{f.reporter.name}</span>
            <span>·</span>
            <span>{formatDate(f.createdAt)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {f.safetyCategory && (
              <Badge tone="neutral">{CATEGORY_META[f.safetyCategory].short}</Badge>
            )}
            {f.pillar && (
              <Badge tone="brand">5S · {PILLAR_META[f.pillar].label}</Badge>
            )}
            <RiskBadge risk={f.riskLevel} />
            {f.dueDate && f.status !== "CLOSED" && (
              <Badge tone="neutral">Target {formatDate(f.dueDate)}</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
