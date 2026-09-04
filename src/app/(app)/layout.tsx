import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { navForRole } from "@/components/layout/nav-items";
import { BottomNav, Sidebar } from "@/components/layout/AppNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ROLE_LABELS } from "@/lib/rbac";
import { IconShield, IconSparkles } from "@/components/icons";
import { Initials } from "@/components/ui/Initials";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // allowPasswordChange=true: layout ini membungkus /profil juga, jadi kalau ia
  // ikut mengalihkan user ber-mustChangePassword ke /profil, hasilnya redirect
  // loop tak terbatas dan user terkunci total. Pengalihan wajib-ganti-password
  // sudah ditangani middleware (src/proxy.ts) untuk semua path selain /profil.
  const user = await requireUser(undefined, true);
  const items = navForRole(user.role);

  return (
    <div className="flex min-h-dvh w-full">
      {/* Sidebar desktop — indigo ala portal Akebono */}
      <aside className="brand-side sticky top-0 hidden h-dvh w-64 shrink-0 flex-col text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 pb-3 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <IconShield size={22} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold">
              AAI 5S &amp; Safety
            </span>
            <span className="block text-[11px] text-white/65">
              Akebono Brake Astra Indonesia
            </span>
          </span>
        </Link>
        <Sidebar items={items} />
        <div className="mt-auto border-t border-white/15 p-4 text-xs text-white/70">
          <p className="font-bold text-white">{user.name}</p>
          <p>
            {user.npk} · {ROLE_LABELS[user.role]}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — indigo di mobile, putih di desktop */}
        <header className="brand-top sticky top-0 z-30 flex h-14 items-center gap-3 px-4 text-white lg:bg-none lg:bg-surface lg:px-6 lg:text-foreground lg:shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <IconShield size={17} />
            </span>
            <span className="text-sm font-extrabold">AAI 5S &amp; Safety</span>
          </Link>
          <span className="hidden text-sm font-bold text-muted lg:block">
            PT Akebono Brake Astra Indonesia
          </span>
          <div className="flex-1" />
          <Link
            href="/asisten-ai"
            title="AI Safety Assistant"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 lg:text-brand lg:hover:bg-brand-soft"
          >
            <IconSparkles size={19} />
          </Link>
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
