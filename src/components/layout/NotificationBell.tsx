import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IconBell } from "@/components/icons";

export async function NotificationBell() {
  const user = await getCurrentUser();
  if (!user) return null;
  const unread = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <Link
      href="/notifikasi"
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-background"
      aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
    >
      <IconBell size={20} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
