// Utility dev: cetak cookie sesi untuk NPK tertentu (untuk curl/test).
// Pakai: npx tsx scripts/dev-token.mjs 10001
import "dotenv/config";
import { SignJWT } from "jose";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const npk = process.argv[2] || "10001";
const u = await prisma.user.findUnique({ where: { npk } });
if (!u) throw new Error("User tidak ditemukan: " + npk);
const key = new TextEncoder().encode(process.env.SESSION_SECRET);
const token = await new SignJWT({ sub: u.id, npk: u.npk, name: u.name, role: u.role })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(key);
console.log(token);
await prisma.$disconnect();
