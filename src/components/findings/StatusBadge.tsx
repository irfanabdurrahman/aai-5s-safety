import { Badge } from "@/components/ui/Badge";
import { STATUS_META, RISK_META, isOverdue } from "@/lib/labels";
import type { FindingStatus, RiskLevel } from "@/generated/prisma/enums";

export function StatusBadge({ status }: { status: FindingStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function RiskBadge({ risk }: { risk: RiskLevel | null }) {
  if (!risk) return null;
  const meta = RISK_META[risk];
  return <Badge tone={meta.tone}>Risiko {meta.label}</Badge>;
}

export function OverdueBadge({
  finding,
}: {
  finding: { dueDate: Date | null; status: FindingStatus };
}) {
  if (!isOverdue(finding)) return null;
  return <Badge tone="danger">Terlambat</Badge>;
}
