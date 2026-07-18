"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav-items";
import { NavIcon } from "./NavIcon";
import { IconPlus } from "@/components/icons";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar untuk HP — 4 item + tombol Lapor di tengah. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const tabs = items.filter((i) => i.mobile);
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2, 4);

  const tab = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
          active ? "text-brand" : "text-muted"
        }`}
      >
        <span
          className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
            active ? "bg-brand-soft" : ""
          }`}
        >
          <NavIcon icon={item.icon} />
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(16,24,40,0.06)] lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch">
        {left.map(tab)}
        <div className="relative flex flex-1 justify-center">
          <Link
            href="/lapor"
            aria-label="Lapor temuan"
            className="tile-red absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-accent/40 active:scale-95"
          >
            <IconPlus size={26} />
          </Link>
          <span className="pt-8 pb-2 text-[10px] font-semibold text-muted">
            Lapor
          </span>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}

/** Sidebar desktop — teks putih di atas indigo. */
export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-white text-brand-dark shadow-sm"
                : "text-white/85 hover:bg-white/10"
            }`}
          >
            <NavIcon icon={item.icon} size={19} />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/lapor"
        className="tile-red mt-3 flex items-center justify-center gap-2 rounded-xl px-3.5 py-3 text-sm font-bold text-white shadow-md shadow-accent/30 hover:brightness-105"
      >
        <IconPlus size={18} />
        Lapor Temuan
      </Link>
    </nav>
  );
}
