// Cek kredensial demo langsung ke DB (dev utility).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const u = await p.user.findUnique({ where: { npk: process.argv[2] || "40001" } });
console.log("user:", u?.name, "| active:", u?.isActive, "| mcp:", u?.mustChangePassword);
console.log("bcrypt ok:", u ? await bcrypt.compare("akebono123", u.passwordHash) : "-");
await p.$disconnect();
