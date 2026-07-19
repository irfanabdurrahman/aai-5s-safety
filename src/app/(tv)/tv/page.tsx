import type { Metadata } from "next";
import { TvBoard } from "./TvBoard";

export const metadata: Metadata = { title: "TV Dashboard" };

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const ok = !!process.env.TV_TOKEN && token === process.env.TV_TOKEN;

  if (!ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0a1428] px-6 text-center text-white">
        <div>
          <p className="text-5xl">📺</p>
          <h1 className="mt-4 text-xl font-extrabold">Mode TV Terkunci</h1>
          <p className="mt-2 text-sm text-white/60">
            Buka dengan URL: <code className="font-bold">/tv?token=…</code>
            <br />
            Token tersedia di admin EHS.
          </p>
        </div>
      </main>
    );
  }

  return <TvBoard token={token!} />;
}
