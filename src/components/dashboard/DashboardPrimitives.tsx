import type { ReactNode } from "react";

export type DashboardTone = "danger" | "warn" | "ok" | "brand" | "info";

const TONES: Record<
  DashboardTone,
  { border: string; icon: string; value: string; bar: string }
> = {
  danger: {
    border: "border-danger/40",
    icon: "bg-danger-soft text-danger",
    value: "text-danger",
    bar: "bg-danger",
  },
  warn: {
    border: "border-warn/40",
    icon: "bg-warn-soft text-warn",
    value: "text-warn",
    bar: "bg-warn",
  },
  ok: {
    border: "border-ok/40",
    icon: "bg-ok-soft text-ok",
    value: "text-ok",
    bar: "bg-ok",
  },
  brand: {
    border: "border-brand/40",
    icon: "bg-brand-soft text-brand",
    value: "text-brand-deeper",
    bar: "bg-brand",
  },
  info: {
    border: "border-info/40",
    icon: "bg-info-soft text-info",
    value: "text-info",
    bar: "bg-info",
  },
};

export function DashboardSection({
  title,
  eyebrow,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border-2 border-line bg-surface shadow-[0_10px_30px_rgba(16,24,40,0.06)] ${className}`}
    >
      <header className="flex flex-col gap-3 border-b border-line bg-background/70 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand">
              {eyebrow}
            </p>
          )}
          <h2 className="text-base font-extrabold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: DashboardTone;
  icon: ReactNode;
}) {
  const styles = TONES[tone];
  return (
    <article
      className={`relative min-h-36 overflow-hidden rounded-2xl border-2 bg-surface p-4 shadow-[0_6px_18px_rgba(16,24,40,0.05)] ${styles.border}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[10rem] text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <span
          aria-hidden="true"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${styles.icon}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-4 text-3xl font-black tracking-tight tabular-nums ${styles.value}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-muted">{detail}</p>
    </article>
  );
}

export function ProgressLine({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: number | null;
  count?: string;
  tone: DashboardTone;
}) {
  const styles = TONES[tone];
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3 text-xs">
        <span className="font-bold text-foreground">{label}</span>
        <span className="font-extrabold tabular-nums text-foreground">
          {value == null ? "—" : `${value}%`}
          {count && <span className="ml-1 font-semibold text-muted">{count}</span>}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-line bg-background">
        {value != null && (
          <div
            className={`h-full rounded-full ${styles.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-background px-4 py-8 text-center text-sm font-semibold text-muted">
      {children}
    </p>
  );
}
