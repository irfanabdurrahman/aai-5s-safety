import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "aai_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 hari (detik)

export type SessionPayload = {
  sub: string; // user id
  npk: string;
  name: string;
  role: Role;
  mcp?: boolean; // mustChangePassword — dipaksa ganti di /profil oleh proxy
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum diset");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      npk: String(payload.npk ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
      mcp: payload.mcp === true,
    };
  } catch {
    return null;
  }
}
