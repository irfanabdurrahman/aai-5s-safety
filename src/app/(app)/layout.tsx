import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { navForRole } from "@/components/layout/nav-items";
import { BottomNav, Sidebar } from "@/components/layout/AppNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ROLE_LABELS } from "@/lib/rbac";
import { IconShield } from "@/components/icons";
import { Initials } from "@/components/ui/Initials";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const items = navForRole(user.role);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 pb-2 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <IconShield size={22} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold text-foreground">
              AAI 5S &amp; Safety
            </span>
            <span className="block text-[11px] text-muted">
              Akebono Brake Astra Indonesia
            </span>
          </span>
        </Link>
        <Sidebar items={items} />
        <div className="mt-auto border-t border-line p-4 text-xs text-muted">
          <p className="font-bold text-foreground">{user.name}</p>
          <p>
            {user.npk} · {ROLE_LABELS[user.role]}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <IconShield size={17} />
            </span>
            <span className="text-sm font-extrabold">AAI 5S &amp; Safety</span>
          </Link>
          <div className="flex-1" />
          <NotificationBell />
          <Link href="/profil" title={user.name}>
            <Initials name={user.name} />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
