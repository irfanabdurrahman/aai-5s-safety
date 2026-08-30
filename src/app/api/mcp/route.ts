import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { registerSafetyTools } from "@/lib/mcp/server";
import { prisma } from "@/lib/prisma";
import {
  sha256Hex,
  MCP_RESOURCE_URL,
  MCP_PROTECTED_RESOURCE_METADATA_PATH,
  ISSUER,
} from "@/lib/oauth";

/** Endpoint MCP (Streamable HTTP) untuk AI eksternal.
 *  Auth: Authorization: Bearer $MCP_TOKEN (statis, jalur lama — Claude Code
 *  CLI dsb) ATAU access token OAuth (claude.ai web / ChatGPT web). */

const mcpHandler = createMcpHandler(
  (server) => {
    registerSafetyTools(server);
  },
  { capabilities: { tools: {} } },
);

async function verifyToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const staticToken = process.env.MCP_TOKEN;
  if (staticToken && bearerToken === staticToken) {
    return { token: bearerToken, clientId: "static-token", scopes: [] };
  }

  const tokenHash = sha256Hex(bearerToken);
  const record = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: tokenHash },
  });
  if (
    !record ||
    record.revokedAt ||
    record.expiresAt <= new Date() ||
    record.resource !== MCP_RESOURCE_URL
  ) {
    return undefined;
  }

  return {
    token: bearerToken,
    clientId: record.clientId,
    scopes: [],
    expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
    resource: new URL(record.resource),
  };
}

const handle = withMcpAuth(mcpHandler, verifyToken, {
  // WAJIB eksplisit: default `required` di mcp-handler adalah false, yang
  // berarti request TANPA token akan diteruskan ke handler tanpa auth sama
  // sekali. Tanpa baris ini endpoint MCP jadi terbuka untuk siapa saja.
  required: true,
  resourceMetadataPath: MCP_PROTECTED_RESOURCE_METADATA_PATH,
  // `resourceUrl` di sini dipakai withMcpAuth sebagai ORIGIN saja (bukan
  // full resource URL) untuk membangun resource_metadata di header
  // WWW-Authenticate — jangan diisi MCP_RESOURCE_URL (yang punya path
  // /api/mcp) atau hasilnya dobel path.
  resourceUrl: ISSUER,
});

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
