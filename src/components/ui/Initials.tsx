/** Avatar inisial nama — satu definisi untuk seluruh app. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export function Initials({
  name,
  size = "md",
  tone = "soft",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "soft" | "solid";
}) {
  const sizeCls = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-14 w-14 text-lg",
  }[size];
  const toneCls =
    tone === "solid"
      ? "bg-brand text-white"
      : "bg-brand-soft text-brand";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${sizeCls} ${toneCls}`}
    >
      {initialsOf(name)}
    </span>
  );
}
