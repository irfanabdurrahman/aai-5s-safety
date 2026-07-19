import { prisma } from "./prisma";
import { throttleKey } from "./login-throttle-policy";

const WINDOW_MINUTES = 15;
const WINDOW_INTERVAL = `${WINDOW_MINUTES} minutes`;
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 30;

async function consumeKey(key: string, limit: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "LoginThrottle" ("key", "count", "expiresAt", "updatedAt")
    VALUES (${key}, 1, NOW() + CAST(${WINDOW_INTERVAL} AS interval), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "LoginThrottle"."expiresAt" <= NOW() THEN 1
        ELSE "LoginThrottle"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "LoginThrottle"."expiresAt" <= NOW()
          THEN NOW() + CAST(${WINDOW_INTERVAL} AS interval)
        ELSE "LoginThrottle"."expiresAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}

export async function consumeLoginAttempt(ip: string, npk: string): Promise<boolean> {
  const accountKey = throttleKey("account", npk);
  const ipKey = throttleKey("ip", ip);
  const [accountAllowed, ipAllowed] = await Promise.all([
    consumeKey(accountKey, ACCOUNT_LIMIT),
    consumeKey(ipKey, IP_LIMIT),
  ]);
  return accountAllowed && ipAllowed;
}

export async function resetLoginAttempts(npk: string): Promise<void> {
  // Reset bucket akun setelah login sah. Bucket IP tetap hidup sampai TTL agar
  // satu akun valid tidak dapat mengosongkan perlindungan IP untuk akun lain.
  await prisma.loginThrottle.deleteMany({
    where: { key: throttleKey("account", npk) },
  });
}

export async function cleanupExpiredLoginAttempts(): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
