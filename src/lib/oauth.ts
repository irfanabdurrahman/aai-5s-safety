import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  oauthMetadataResponse,
  getOAuthProtectedResourceMetadataUrl,
  type OAuthMetadata,
} from "@modelcontextprotocol/server";

/** Identitas resource MCP yang tetap (RFC 8707) — selalu domain safety5s.com,
 *  terlepas dari domain mana request masuk (app juga dilayani di
 *  irfan-apps.online). Jalur static-token lama tidak terpengaruh nilai ini. */
export const MCP_RESOURCE_URL = "https://safety5s.com/api/mcp";
export const ISSUER = "https://safety5s.com";

export const OAUTH_METADATA: OAuthMetadata = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth/authorize`,
  token_endpoint: `${ISSUER}/oauth/token`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: [
    "client_secret_post",
    "client_secret_basic",
  ],
  scopes_supported: ["mcp"],
};

const metadataOptions = {
  oauthMetadata: OAUTH_METADATA,
  resourceServerUrl: new URL(MCP_RESOURCE_URL),
  resourceName: "AAI 5S & Safety MCP",
};

/** RFC 9728 protected-resource metadata path-aware terhadap path resource
 *  (MCP_RESOURCE_URL punya path /api/mcp), jadi dokumennya ada di
 *  /.well-known/oauth-protected-resource/api/mcp — BUKAN path polos.
 *  Dipakai sebagai `resourceMetadataPath` di withMcpAuth supaya challenge
 *  401 menunjuk ke lokasi yang benar-benar dilayani. */
export const MCP_PROTECTED_RESOURCE_METADATA_PATH = new URL(
  getOAuthProtectedResourceMetadataUrl(new URL(MCP_RESOURCE_URL)),
).pathname;

/** Handler tunggal untuk /.well-known/oauth-protected-resource DAN
 *  /.well-known/oauth-authorization-server (SDK resmi yang menentukan
 *  dokumen mana berdasarkan path request). */
export async function handleOAuthMetadata(request: Request): Promise<Response> {
  return (
    oauthMetadataResponse(request, metadataOptions) ??
    new Response("Not Found", { status: 404 })
  );
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Bandingkan 2 string rahasia tanpa bocorkan waktu eksekusi lewat isi byte
 *  (dipakai untuk password admin & client secret — BUKAN untuk PKCE, yang
 *  tidak memerlukan timing-safe compare karena bukan rahasia jangka panjang). */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

/** Whitelist redirect_uri: parse dengan URL() (bukan string prefix longgar)
 *  supaya tidak bisa disusupi trik path. claude.ai & ChatGPT (host tetap),
 *  plus loopback generik untuk client native/CLI (Hermes, dsb) mengikuti
 *  RFC 8252 §7.3 — authorization server WAJIB menerima port loopback
 *  berapa pun, bukan cuma satu port tetap, karena native app biasanya
 *  memilih port ephemeral saat runtime. Keamanannya tetap terjaga oleh
 *  PKCE (code_verifier) yang wajib di jalur token exchange. */
export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol === "http:" && isLoopbackHostname(url.hostname)) {
    return url.pathname === "/callback";
  }

  if (url.protocol !== "https:") return false;

  if (url.origin === "https://claude.ai") {
    return url.pathname === "/api/mcp/auth_callback";
  }

  if (url.origin === "https://chatgpt.com") {
    if (url.pathname === "/connector_platform_oauth_redirect") return true;
    const segments = url.pathname.split("/");
    return (
      segments.length === 4 &&
      segments[0] === "" &&
      segments[1] === "connector" &&
      segments[2] === "oauth" &&
      segments[3].length > 0
    );
  }

  return false;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}
