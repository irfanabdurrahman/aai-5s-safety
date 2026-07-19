import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markAllRead } from "@/actions/notifications";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/labels";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function NotifikasiPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Notifikasi</h1>
        {hasUnread && (
          <form action={markAllRead}>
            <Button type="submit" variant="ghost" size="sm" className="text-brand">
              Tandai semua dibaca
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-14 text-center text-sm font-semibold text-muted">
          Belum ada notifikasi.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const href = n.findingId
              ? `/temuan/${n.findingId}`
              : n.auditId
                ? `/audit/${n.auditId}`
                : "/";
            return (
              <Link
                key={n.id}
                href={href}
                className={`block rounded-xl border px-4 py-3 ${
                  n.isRead
                    ? "border-line bg-surface"
                    : "border-brand/30 bg-brand-soft"
                }`}
              >
                <p className="text-sm font-bold">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {n.body}
                  </p>
                )}
                <p className="mt-1 text-[11px] font-semibold text-muted">
                  {formatDateTime(n.createdAt)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
