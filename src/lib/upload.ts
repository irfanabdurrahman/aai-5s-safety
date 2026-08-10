import "server-only";
import { mkdir, writeFile, rename, unlink, realpath, lstat } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Keep the filesystem trace statically scoped. In Docker, process.cwd() is /app,
// so this resolves to the persistent /app/uploads volume.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const signatures = [
  { type: "image/jpeg", ext: "jpg", test: (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  { type: "image/webp", ext: "webp", test: (b: Buffer) => b.length >= 12 && b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP" },
];

/** Validasi isi (magic bytes), tulis staging, lalu rename atomik ke nama final. */
export async function savePhoto(file: File): Promise<string> {
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) throw new Error("Ukuran foto maksimal 8MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = signatures.find((s) => s.test(buffer));
  if (!detected || file.type !== detected.type) throw new Error("Isi foto tidak cocok dengan format JPG, PNG, atau WebP");
  return writePhotoAtomic(buffer, detected.ext);
}

/** Simpan foto dari buffer mentah (intake WhatsApp/MCP — bukan FormData).
 *  Validasi magic bytes sama seperti savePhoto; mime harus cocok dengan isi. */
export async function savePhotoBuffer(buffer: Buffer, mime: string): Promise<string> {
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_PHOTO_BYTES) throw new Error("Ukuran foto maksimal 8MB");
  const detected = signatures.find((s) => s.test(buffer));
  if (!detected || mime !== detected.type) throw new Error("Isi foto tidak cocok dengan format JPG, PNG, atau WebP");
  return writePhotoAtomic(buffer, detected.ext);
}

async function writePhotoAtomic(buffer: Buffer, ext: string): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const root = await realpath(UPLOAD_DIR);
  if (root !== UPLOAD_DIR) throw new Error("Direktori upload tidak aman");
  const now = new Date();
  const dir = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}`;
  const finalDir = path.join(root, dir);
  await mkdir(finalDir, { recursive: true });
  const name = `${Date.now()}_${crypto.randomBytes(12).toString("hex")}.${ext}`;
  const staging = path.join(root, `.staging-${crypto.randomUUID()}`);
  const target = path.join(finalDir, name);
  try { await writeFile(staging, buffer, { flag: "wx", mode: 0o640 }); await rename(staging, target); }
  catch (error) { await unlink(staging).catch(()=>{}); throw error; }
  return `${dir}/${name}`;
}

export async function removePhotos(paths: string[]) { await Promise.all(paths.map(async p => { const abs=await resolveUploadPath(p); if(abs) await unlink(abs).catch(()=>{}); })); }

/** Realpath+lstat menolak traversal dan symlink. */
export async function resolveUploadPath(relPath: string): Promise<string | null> {
  if (!relPath || relPath.includes("\0")) return null;
  const candidate = path.resolve(UPLOAD_DIR, relPath);
  if (!candidate.startsWith(UPLOAD_DIR + path.sep)) return null;
  try { const stat=await lstat(candidate); if(!stat.isFile()||stat.isSymbolicLink())return null; const actual=await realpath(candidate); return actual.startsWith(UPLOAD_DIR+path.sep)?actual:null; } catch { return null; }
}
