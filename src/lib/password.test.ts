import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, generateTemporaryPassword, passwordSchema } from "./password";

describe("password policy", () => {
  it("requires at least 12 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(passwordSchema.safeParse("12345678901").success).toBe(false);
    expect(passwordSchema.safeParse("correct horse").success).toBe(true);
  });
  it("generates unique random temporary passwords that satisfy policy", () => {
    const values = new Set(Array.from({ length: 100 }, generateTemporaryPassword));
    expect(values.size).toBe(100);
    for (const value of values) expect(passwordSchema.safeParse(value).success).toBe(true);
  });
});
