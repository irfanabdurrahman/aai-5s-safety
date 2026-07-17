import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { IconShield } from "@/components/icons";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");
  const { return: returnTo } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand to-brand-dark px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <IconShield size={34} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            AAI 5S &amp; Safety
          </h1>
          <p className="mt-1 text-sm text-white/70">
            PT Akebono Brake Astra Indonesia
          </p>
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-xl">
          <LoginForm returnTo={returnTo} />
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          Masuk dengan NPK dan password yang diberikan admin EHS.
        </p>
      </div>
    </main>
  );
}
