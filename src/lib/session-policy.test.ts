import { describe, expect, it } from "vitest";
import { isSessionUserValid } from "./session-policy";

describe("session version policy", () => {
  const user = { isActive: true, mustChangePassword: false, sessionVersion: 4 };
  it("accepts matching active sessions", () => expect(isSessionUserValid({ sv: 4 }, user)).toBe(true));
  it("revokes stale versions", () => expect(isSessionUserValid({ sv: 3 }, user)).toBe(false));
  it("blocks inactive and mandatory-password-change accounts", () => {
    expect(isSessionUserValid({ sv: 4 }, { ...user, isActive: false })).toBe(false);
    expect(isSessionUserValid({ sv: 4 }, { ...user, mustChangePassword: true })).toBe(false);
  });
});
