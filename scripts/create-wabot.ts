/* One-off: buat user WA-BOT di DB target (DATABASE_URL dari env shell).
   Password = hash dari string acak (bot tidak pernah login interaktif). */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const u = await prisma.user.upsert({
    where: { npk: "WA-BOT" },
    update: {},
    create: {
      npk: "WA-BOT",
      name: "Bot WhatsApp",
      role: "KARYAWAN",
      passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10),
      departmentId: null,
    },
  });
  console.log("WA-BOT:", u.npk, u.name, u.role);
  await prisma.$disconnect();
}

main();
