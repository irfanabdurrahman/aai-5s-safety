import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAllowedRedirectUri, MCP_RESOURCE_URL, ISSUER } from "@/lib/oauth";
import { IconShield } from "@/components/icons";
import { AuthorizeForm } from "./AuthorizeForm";

export const metadata: Metadata = { title: "Izinkan Akses MCP" };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const responseType = firstValue(sp.response_type);
  const clientId = firstValue(sp.client_id);
  const redirectUri = firstValue(sp.redirect_uri);
  const codeChallenge = firstValue(sp.code_challenge);
  const codeChallengeMethod = firstValue(sp.code_challenge_method);
  const resource = firstValue(sp.resource);
  const state = firstValue(sp.state);

  // redirect_uri tidak dipercaya sebelum divalidasi — kalau tidak dikenal,
  // JANGAN redirect ke sana (prinsip keamanan OAuth standar), tampilkan
  // error lokal saja.
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5">
        <div className="max-w-sm rounded-2xl bg-surface p-6 text-center shadow-xl">
          <h1 className="text-lg font-bold text-foreground">
            Permintaan tidak valid
          </h1>
          <p className="mt-2 text-sm text-muted">
            redirect_uri tidak dikenal atau tidak diizinkan.
          </p>
        </div>
      </main>
    );
  }

  const expectedClientId = process.env.MCP_OAUTH_CLIENT_ID;
  const invalid =
    responseType !== "code" ||
    !clientId ||
    clientId !== expectedClientId ||
    !codeChallenge ||
    codeChallengeMethod !== "S256" ||
    resource !== MCP_RESOURCE_URL;

  if (invalid) {
    const target = new URL(redirectUri);
    target.searchParams.set("error", "invalid_request");
    target.searchParams.set("iss", ISSUER);
    if (state) target.searchParams.set("state", state);
    redirect(target.toString());
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-[#6a72cf] via-brand to-brand-deeper px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <IconShield size={34} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Izinkan Akses MCP
          </h1>
          <p className="mt-1 text-sm text-white/70">AAI 5S &amp; Safety</p>
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-xl">
          <p className="mb-4 text-sm text-muted">
            Sebuah aplikasi AI meminta akses ke data MCP safety5s.com.
            Masukkan password admin MCP untuk mengizinkan.
          </p>
          <AuthorizeForm
            clientId={clientId as string}
            redirectUri={redirectUri}
            codeChallenge={codeChallenge as string}
            resource={resource as string}
            state={state}
          />
        </div>
      </div>
    </main>
  );
}
