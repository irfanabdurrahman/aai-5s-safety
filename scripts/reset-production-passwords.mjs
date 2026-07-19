import { randomBytes } from "node:crypto";
import { writeFile, chmod, unlink } from "node:fs/promises";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const output = process.env.PASSWORD_RESET_OUTPUT;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL wajib tersedia");
if (!output) throw new Error("PASSWORD_RESET_OUTPUT wajib tersedia");

function temporaryPassword() {
  return `Aa9!${randomBytes(12).toString("base64url")}`;
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const users = await client.query(
    'SELECT id, npk, name, role, "isActive" FROM "User" ORDER BY role, npk',
  );
  const credentials = [];

  await client.query("BEGIN");
  for (const user of users.rows) {
    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      'UPDATE "User" SET "passwordHash"=$1, "mustChangePassword"=true, "sessionVersion"="sessionVersion"+1 WHERE id=$2',
      [passwordHash, user.id],
    );
    credentials.push({
      npk: user.npk,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      temporaryPassword: password,
    });
  }
  // Persist credential distribution before committing DB changes. If writing
  // fails, the transaction rolls back and no account is left inaccessible.
  await writeFile(
    output,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        instruction:
          "Distribusikan secara privat. Pengguna wajib mengganti password pada login pertama.",
        credentials,
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  await chmod(output, 0o600);
  try {
    await client.query("COMMIT");
  } catch (error) {
    await unlink(output).catch(() => {});
    throw error;
  }
  process.stdout.write(`Reset aman selesai untuk ${credentials.length} akun.\n`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
