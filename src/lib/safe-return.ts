export function safeReturnUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (/[\\\u0000-\u001f\u007f]/.test(value) || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  try {
    const base = new URL("https://internal.invalid");
    const url = new URL(value, base);
    return url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}
