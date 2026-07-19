import { randomBytes } from "crypto";
import { z } from "zod";
export const MIN_PASSWORD_LENGTH = 12;
export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Password minimal ${MIN_PASSWORD_LENGTH} karakter`).max(128);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
export function generateTemporaryPassword(length = 20): string {
  if (length < MIN_PASSWORD_LENGTH) throw new Error("Panjang password sementara tidak memenuhi kebijakan");
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
