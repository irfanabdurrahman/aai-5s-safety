import { SignJWT, jwtVerify } from "jose";

export const KIOSK_COOKIE = "aai_kiosk";
export const KIOSK_MAX_AGE = 12 * 60 * 60;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum diset");
  return new TextEncoder().encode(secret);
}

export async function signKioskSession(): Promise<string> {
  return new SignJWT({ scope: "kiosk" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${KIOSK_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifyKioskSession(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.scope === "kiosk";
  } catch {
    return false;
  }
}

export function isRawTvTokenValid(token: string | null | undefined): boolean {
  return !!process.env.TV_TOKEN && token === process.env.TV_TOKEN;
}
