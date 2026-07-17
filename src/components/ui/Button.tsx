import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "ok";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50",
  accent:
    "bg-accent text-white hover:brightness-90 disabled:opacity-50",
  outline:
    "border border-line bg-surface text-foreground hover:bg-background disabled:opacity-50",
  ghost: "text-foreground hover:bg-background disabled:opacity-50",
  danger:
    "bg-danger text-white hover:brightness-90 disabled:opacity-50",
  ok: "bg-ok text-white hover:brightness-90 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
