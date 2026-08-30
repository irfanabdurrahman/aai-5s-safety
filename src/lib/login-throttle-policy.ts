import { createHash } from "node:crypto";

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (chain.length) return chain[chain.length - 1];
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function throttleKey(
  scope: "account" | "ip" | "oauth_consent",
  value: string,
): string {
  const normalized = value.trim().toLowerCase();
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `${scope}:${digest}`;
}
