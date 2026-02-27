import crypto from "crypto";

const HASH_PART_LENGTH = 128;
const DEFAULT_PASSWORD_MIN_LENGTH = 8;

export type PasswordPolicyConfig = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
};

export type PasswordPolicyResult = {
  ok: boolean;
  errors: string[];
  policy: PasswordPolicyConfig;
};

function toIntEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function toBoolEnv(value: string | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

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

export function getPasswordPolicyConfig(): PasswordPolicyConfig {
  return {
    minLength: toIntEnv(process.env.AUTH_PASSWORD_MIN_LENGTH, DEFAULT_PASSWORD_MIN_LENGTH, 6, 64),
    requireUppercase: toBoolEnv(process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE, true),
    requireLowercase: toBoolEnv(process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE, true),
    requireDigit: toBoolEnv(process.env.AUTH_PASSWORD_REQUIRE_DIGIT, true)
  };
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const policy = getPasswordPolicyConfig();
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("password must include at least one uppercase letter");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("password must include at least one lowercase letter");
  }
  if (policy.requireDigit && !/\d/.test(password)) {
    errors.push("password must include at least one digit");
  }

  return {
    ok: errors.length === 0,
    errors,
    policy
  };
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
