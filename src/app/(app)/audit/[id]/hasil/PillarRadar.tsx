"use client";

/** Radar 5 pilar — SVG ringan tanpa dependency chart. */
export function PillarRadar({
  data,
}: {
  data: { pillar: string; label: string; pct: number }[];
}) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;
  const n = data.length;

  const point = (i: number, radius: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };

  const ringPath = (radius: number) =>
    data.map((_, i) => point(i, radius).join(",")).join(" ");

  const valuePath = data
    .map((d, i) => point(i, (d.pct / 100) * r).join(","))
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto block w-full max-w-60"
      role="img"
      aria-label="Radar skor per pilar 5S"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={ringPath(r * f)}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, r);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={valuePath}
        fill="var(--brand-primary)"
        fillOpacity="0.18"
        stroke="var(--brand-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const [x, y] = point(i, (d.pct / 100) * r);
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--brand-primary)" />;
      })}
      {data.map((d, i) => {
        const [x, y] = point(i, r + 16);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--muted)] text-[10px] font-bold"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
