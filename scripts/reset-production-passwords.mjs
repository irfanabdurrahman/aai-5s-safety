import { randomBytes } from "node:crypto";
import { open, readFile, rename, chmod, lstat, unlink } from "node:fs/promises";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const output = process.env.PASSWORD_RESET_OUTPUT;
const databaseUrl = process.env.DATABASE_URL;
const batchId = process.env.PASSWORD_RESET_BATCH_ID;
const releaseId = process.env.APP_RELEASE_ID;

if (!databaseUrl) throw new Error("DATABASE_URL wajib tersedia");
if (!output) throw new Error("PASSWORD_RESET_OUTPUT wajib tersedia");
if (!batchId || !/^[a-zA-Z0-9._-]{8,96}$/.test(batchId)) {
  throw new Error("PASSWORD_RESET_BATCH_ID tidak valid");
}
if (!releaseId || !/^release-\d{8}-\d{6}$/.test(releaseId)) {
  throw new Error("APP_RELEASE_ID tidak valid");
}

const prepared = `${output}.${batchId}.prepared`;

function temporaryPassword() {
  return `Aa9!${randomBytes(12).toString("base64url")}`;
}

async function regularPrivateFile(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error("Artifact reset bukan regular root-private file");
  }
}

async function readArtifact(path) {
  await regularPrivateFile(path);
  const artifact = JSON.parse(await readFile(path, "utf8"));
  if (artifact.batchId !== batchId || artifact.releaseId !== releaseId) {
    throw new Error("Artifact reset bukan milik batch/release ini");
  }
  if (!Array.isArray(artifact.credentials) || artifact.credentials.length === 0) {
    throw new Error("Artifact reset tidak memiliki credential");
  }
  return artifact;
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function createPrepared(users) {
  const artifact = {
    batchId,
    releaseId,
    generatedAt: new Date().toISOString(),
    instruction:
      "Distribusikan secara privat. Pengguna wajib mengganti password pada login pertama.",
    credentials: users.map((user) => ({
      userId: user.id,
      npk: user.npk,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      temporaryPassword: temporaryPassword(),
    })),
  };
  const handle = await open(prepared, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(artifact, null, 2));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(prepared, 0o600);
  return artifact;
}

async function finalizeArtifact() {
  if (await exists(output)) {
    await readArtifact(output);
    if (await exists(prepared)) await unlink(prepared);
    return;
  }
  await regularPrivateFile(prepared);
  await rename(prepared, output);
  await chmod(output, 0o600);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const committed = await client.query(
    'SELECT id, "releaseId", "userCount" FROM "AccountResetBatch" WHERE id=$1',
    [batchId],
  );
  if (committed.rowCount === 1) {
    if (committed.rows[0].releaseId !== releaseId) {
      throw new Error("Batch ID sudah dipakai release lain");
    }
    await finalizeArtifact();
    process.stdout.write(
      `Reset batch sudah committed untuk ${committed.rows[0].userCount} akun; artifact terfinalisasi.\n`,
    );
  } else {
    const initialUsers = await client.query(
      'SELECT id, npk, name, role, "isActive" FROM "User" ORDER BY role, npk',
    );
    let artifact;
    if (await exists(prepared)) artifact = await readArtifact(prepared);
    else artifact = await createPrepared(initialUsers.rows);

    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [batchId]);
      const ledger = await client.query(
        'SELECT id, "releaseId", "userCount" FROM "AccountResetBatch" WHERE id=$1',
        [batchId],
      );
      if (ledger.rowCount === 1) {
        if (ledger.rows[0].releaseId !== releaseId) {
          throw new Error("Batch ID sudah dipakai release lain");
        }
      } else {
        const users = await client.query(
          'SELECT id, npk, name, role, "isActive" FROM "User" ORDER BY role, npk FOR UPDATE',
        );
        const actualIds = users.rows.map((user) => user.id).sort();
        const artifactIds = artifact.credentials.map((item) => item.userId).sort();
        if (JSON.stringify(actualIds) !== JSON.stringify(artifactIds)) {
          throw new Error("Daftar akun berubah setelah batch dipersiapkan");
        }
        const credentialById = new Map(
          artifact.credentials.map((item) => [item.userId, item]),
        );
        for (const user of users.rows) {
          const credential = credentialById.get(user.id);
          const passwordHash = await bcrypt.hash(credential.temporaryPassword, 12);
          await client.query(
            'UPDATE "User" SET "passwordHash"=$1, "mustChangePassword"=true, "sessionVersion"="sessionVersion"+1 WHERE id=$2',
            [passwordHash, user.id],
          );
        }
        await client.query(
          'INSERT INTO "AccountResetBatch" (id, "releaseId", "userCount") VALUES ($1,$2,$3)',
          [batchId, releaseId, users.rowCount],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }

    await finalizeArtifact();
    process.stdout.write(
      `Reset batch committed dan artifact terfinalisasi untuk ${artifact.credentials.length} akun.\n`,
    );
  }
} finally {
  await client.end();
}
