import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KIOSK_COOKIE,
  signKioskSession,
  verifyKioskSession,
} from "./kiosk-session";

const originalSecret = process.env.SESSION_SECRET;

describe("kiosk session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-long-enough-for-signing";
  });
  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("exchanges kiosk access into a signed scoped session without embedding the TV token", async () => {
    const session = await signKioskSession();
    expect(session).not.toContain("raw-tv-secret");
    expect(await verifyKioskSession(session)).toBe(true);
    expect(KIOSK_COOKIE).toBe("aai_kiosk");
  });

  it("rejects a forged kiosk session", async () => {
    expect(await verifyKioskSession("forged.value")).toBe(false);
  });
});
