import { describe, expect, it } from "vitest";
import { healthIdentity } from "./health";

describe("health identity", () => {
  it("exposes immutable non-secret release and schema markers", () => {
    expect(
      healthIdentity({
        APP_RELEASE_ID: "release-20260719-191500",
        APP_SCHEMA_MARKER: "20260719193500_audit_schedule_created_at",
      }),
    ).toEqual({
      release: "release-20260719-191500",
      schema: "20260719193500_audit_schedule_created_at",
    });
  });

  it("fails closed when build identity is missing", () => {
    expect(() => healthIdentity({})).toThrow("APP_RELEASE_ID");
  });
});
