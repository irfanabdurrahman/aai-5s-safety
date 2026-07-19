import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { GaleriBoard } from "./GaleriBoard";

export const metadata: Metadata = { title: "Galeri Temuan" };

export default async function GaleriPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tvOk = !!process.env.TV_TOKEN && token === process.env.TV_TOKEN;
  const session = tvOk ? null : await getSession();

  if (!tvOk && !session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#171b46] px-6 text-center text-white">
        <div>
          <p className="text-5xl">🖼️</p>
          <h1 className="mt-4 text-xl font-extrabold">Galeri Terkunci</h1>
          <p className="mt-2 text-sm text-white/60">
            Login dulu di aplikasi, atau buka dengan{" "}
            <code className="font-bold">/galeri?token=…</code> untuk TV.
          </p>
        </div>
      </main>
    );
  }

  return <GaleriBoard token={tvOk ? token! : null} />;
}
