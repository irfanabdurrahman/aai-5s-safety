"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/login-throttle-policy";
import { consumeOAuthConsentAttempt } from "@/lib/login-throttle";
import {
  isAllowedRedirectUri,
  sha256Hex,
  generateOpaqueToken,
  timingSafeStringEqual,
  MCP_RESOURCE_URL,
  ISSUER,
} from "@/lib/oauth";

export type OAuthActionState = { error?: string };

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

const schema = z.object({
  admin_password: z.string().min(1),
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  code_challenge: z.string().min(1),
  resource: z.string().min(1),
  state: z.string().optional(),
});

export async function authorizeConsent(
  _prev: OAuthActionState,
  formData: FormData,
): Promise<OAuthActionState> {
  const parsed = schema.safeParse({
    admin_password: formData.get("admin_password"),
    client_id: formData.get("client_id"),
    redirect_uri: formData.get("redirect_uri"),
    code_challenge: formData.get("code_challenge"),
    resource: formData.get("resource"),
    state: formData.get("state") || undefined,
  });
  if (!parsed.success) {
    return { error: "Permintaan tidak valid" };
  }
  const {
    admin_password: adminPassword,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    resource,
    state,
  } = parsed.data;

  // Validasi ulang di server action — hidden field dari form tidak dipercaya
  // begitu saja (bisa dimanipulasi klien).
  if (
    !isAllowedRedirectUri(redirectUri) ||
    clientId !== process.env.MCP_OAUTH_CLIENT_ID ||
    resource !== MCP_RESOURCE_URL
  ) {
    return { error: "Permintaan tidak valid" };
  }

  const headerStore = await headers();
  const ip = clientIpFromHeaders(headerStore);
  if (!(await consumeOAuthConsentAttempt(ip))) {
    return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
  }

  const expected = process.env.MCP_OAUTH_ADMIN_PASSWORD;
  if (!expected || !timingSafeStringEqual(adminPassword, expected)) {
    return { error: "Password salah" };
  }

  const rawCode = generateOpaqueToken();
  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: sha256Hex(rawCode),
      clientId,
      redirectUri,
      codeChallenge,
      resource,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", rawCode);
  target.searchParams.set("iss", ISSUER);
  if (state) target.searchParams.set("state", state);
  redirect(target.toString());
}
