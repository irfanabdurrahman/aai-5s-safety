import { NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { registerSafetyTools } from "@/lib/mcp/server";

/** Endpoint MCP (Streamable HTTP) untuk AI eksternal.
 *  Auth sederhana: Authorization: Bearer $MCP_TOKEN. */

const handler = createMcpHandler(
  (server) => {
    registerSafetyTools(server);
  },
  { capabilities: { tools: {} } },
);

function authorized(request: Request): boolean {
  const expected = process.env.MCP_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handler(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
