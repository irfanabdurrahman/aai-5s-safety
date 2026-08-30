import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sha256Hex,
  generateOpaqueToken,
  timingSafeStringEqual,
  verifyPkceS256,
} from "@/lib/oauth";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function oauthError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function extractClientCredentials(
  request: Request,
  body: URLSearchParams,
): { clientId: string; clientSecret: string } | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;
    return { clientId: decoded.slice(0, idx), clientSecret: decoded.slice(idx + 1) };
  }
  const clientId = body.get("client_id");
  const clientSecret = body.get("client_secret");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function issueTokenPair(clientId: string, resource: string) {
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();
  const now = Date.now();
  await prisma.oAuthToken.create({
    data: {
      accessTokenHash: sha256Hex(accessToken),
      refreshTokenHash: sha256Hex(refreshToken),
      clientId,
      resource,
      expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    },
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
  };
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return oauthError("invalid_request");
  }
  const body = new URLSearchParams(await request.text());
  const grantType = body.get("grant_type");

  const credentials = extractClientCredentials(request, body);
  const expectedClientId = process.env.MCP_OAUTH_CLIENT_ID;
  const expectedClientSecret = process.env.MCP_OAUTH_CLIENT_SECRET;
  if (
    !credentials ||
    !expectedClientId ||
    !expectedClientSecret ||
    credentials.clientId !== expectedClientId ||
    !timingSafeStringEqual(credentials.clientSecret, expectedClientSecret)
  ) {
    return oauthError("invalid_client", 401);
  }

  if (grantType === "authorization_code") {
    const code = body.get("code");
    const redirectUri = body.get("redirect_uri");
    const codeVerifier = body.get("code_verifier");
    if (!code || !redirectUri || !codeVerifier) {
      return oauthError("invalid_request");
    }

    const codeHash = sha256Hex(code);
    // Consume sekali pakai secara atomik — mencegah replay lewat race
    // read-then-write (pola sama seperti upsert LoginThrottle).
    const rows = await prisma.$queryRaw<
      Array<{
        clientId: string;
        redirectUri: string;
        codeChallenge: string;
        resource: string;
      }>
    >`
      UPDATE "OAuthAuthCode"
      SET "consumedAt" = NOW()
      WHERE "codeHash" = ${codeHash}
        AND "consumedAt" IS NULL
        AND "expiresAt" > NOW()
      RETURNING "clientId", "redirectUri", "codeChallenge", "resource"
    `;
    const record = rows[0];
    if (!record) {
      return oauthError("invalid_grant");
    }
    if (
      record.clientId !== credentials.clientId ||
      record.redirectUri !== redirectUri ||
      !verifyPkceS256(codeVerifier, record.codeChallenge)
    ) {
      return oauthError("invalid_grant");
    }

    return NextResponse.json(await issueTokenPair(record.clientId, record.resource));
  }

  if (grantType === "refresh_token") {
    const refreshToken = body.get("refresh_token");
    if (!refreshToken) return oauthError("invalid_request");

    const refreshHash = sha256Hex(refreshToken);
    const existing = await prisma.oAuthToken.findUnique({
      where: { refreshTokenHash: refreshHash },
    });
    if (
      !existing ||
      existing.revokedAt ||
      !existing.refreshExpiresAt ||
      existing.refreshExpiresAt <= new Date() ||
      existing.clientId !== credentials.clientId
    ) {
      return oauthError("invalid_grant");
    }

    // Rotasi wajib untuk public/confidential client — token lama langsung mati.
    await prisma.oAuthToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json(
      await issueTokenPair(existing.clientId, existing.resource),
    );
  }

  return oauthError("unsupported_grant_type");
}
