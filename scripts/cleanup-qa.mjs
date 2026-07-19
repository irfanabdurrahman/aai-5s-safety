// Hapus temuan tes QA (deskripsi berawalan "TES QA") — dev utility.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const r = await p.finding.deleteMany({
  where: { description: { startsWith: "TES QA" } },
});
console.log("deleted:", r.count);
await p.$disconnect();
