import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB (sudah dikompres di client)

export function uploadRoot() {
  return UPLOAD_DIR;
}

/** Simpan foto ke disk, return path relatif (disimpan di DB). */
export async function savePhoto(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WebP");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Ukuran foto maksimal 8MB");
  }
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const now = new Date();
  const dir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const name = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await mkdir(path.join(UPLOAD_DIR, dir), { recursive: true });
  await writeFile(
    path.join(UPLOAD_DIR, dir, name),
    Buffer.from(await file.arrayBuffer()),
  );
  return `${dir}/${name}`;
}

/** Path absolut file upload; null jika mencoba keluar dari folder upload. */
export function resolveUploadPath(relPath: string): string | null {
  const abs = path.resolve(UPLOAD_DIR, relPath);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return null;
  return abs;
}
