import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { GaleriBoard } from "./GaleriBoard";
import { cookies } from "next/headers";
import { KIOSK_COOKIE, verifyKioskSession } from "@/lib/kiosk-session";

export const metadata: Metadata = { title: "Safety & 5S Live Wall" };

export default async function GaleriPage() {
  const store = await cookies();
  const tvOk = await verifyKioskSession(store.get(KIOSK_COOKIE)?.value);
  const session = tvOk ? null : await getSession();

  if (!tvOk && !session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#171b46] px-6 text-center text-white">
        <div>
          <p className="text-5xl">🛡️</p>
          <h1 className="mt-4 text-xl font-extrabold">
            Safety &amp; 5S Live Wall Terkunci
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Login dulu di aplikasi, atau buka dengan{" "}
            <code className="font-bold">/galeri?token=…</code> untuk TV.
          </p>
        </div>
      </main>
    );
  }

  return <GaleriBoard />;
}
