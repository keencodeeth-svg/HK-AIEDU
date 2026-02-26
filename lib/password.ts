import crypto from "crypto";

const HASH_PART_LENGTH = 128;

function isHex(value: string) {
  return /^[0-9a-f]+$/i.test(value);
}

export function isScryptHash(value: string) {
  const parts = value.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  return salt.length > 0 && hash.length === HASH_PART_LENGTH && isHex(salt) && isHex(hash);
}

export function hashPassword(input: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(input, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function allowLegacyPlainPasswords() {
  if (process.env.ALLOW_LEGACY_PLAIN_PASSWORDS === "true") return true;
  if (process.env.ALLOW_LEGACY_PLAIN_PASSWORDS === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function verifyPassword(input: string, stored: string) {
  if (stored.startsWith("plain:")) {
    if (!allowLegacyPlainPasswords()) {
      return false;
    }
    return input === stored.slice("plain:".length);
  }

  if (!isScryptHash(stored)) return false;
  const [salt, hash] = stored.split(":");
  const derived = crypto.scryptSync(input, salt, 64).toString("hex");
  const hashBuf = Buffer.from(hash, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  if (hashBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, derivedBuf);
}

export function normalizeBootstrapPassword(rawPassword: string) {
  if (isScryptHash(rawPassword)) {
    return rawPassword;
  }

  if (rawPassword.startsWith("plain:")) {
    const plain = rawPassword.slice("plain:".length);
    return allowLegacyPlainPasswords() ? rawPassword : hashPassword(plain);
  }

  return hashPassword(rawPassword);
}
