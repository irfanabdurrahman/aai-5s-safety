import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, throttleKey } from "./login-throttle-policy";

describe("database login throttle helpers", () => {
  it("uses the proxy-appended rightmost forwarded address", () => {
    const headers = new Headers({
      "x-forwarded-for": "spoofed.example, 198.51.100.12",
      "x-real-ip": "10.0.0.2",
    });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.12");
  });

  it("falls back to x-real-ip and never stores raw account/IP values", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.7");
    const key = throttleKey("account", " Employee-01 ");
    expect(key).toMatch(/^account:[a-f0-9]{64}$/);
    expect(key).not.toContain("employee-01");
  });
});
