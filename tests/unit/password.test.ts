import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  allowLegacyPlainPasswords,
  getPasswordPolicyConfig,
  hashPassword,
  isScryptHash,
  normalizeBootstrapPassword,
  validatePasswordPolicy,
  verifyPassword
} from "../../lib/password";

const ENV_KEYS = [
  "ALLOW_LEGACY_PLAIN_PASSWORDS",
  "AUTH_PASSWORD_MIN_LENGTH",
  "AUTH_PASSWORD_REQUIRE_DIGIT",
  "AUTH_PASSWORD_REQUIRE_LOWERCASE",
  "AUTH_PASSWORD_REQUIRE_UPPERCASE",
  "NODE_ENV"
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  restoreEnv();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  restoreEnv();
});

test("default password policy rejects weak password and accepts strong password", () => {
  setEnv({
    NODE_ENV: "development",
    AUTH_PASSWORD_MIN_LENGTH: undefined,
    AUTH_PASSWORD_REQUIRE_UPPERCASE: undefined,
    AUTH_PASSWORD_REQUIRE_LOWERCASE: undefined,
    AUTH_PASSWORD_REQUIRE_DIGIT: undefined
  });

  const weak = validatePasswordPolicy("weak");
  assert.equal(weak.ok, false);
  assert.ok(weak.errors.some((item) => item.includes("at least 8 characters")));
  assert.ok(weak.errors.some((item) => item.includes("uppercase")));
  assert.ok(weak.errors.some((item) => item.includes("digit")));

  const strong = validatePasswordPolicy("Strong123");
  assert.equal(strong.ok, true);
  assert.deepEqual(strong.errors, []);
});

test("password policy honors environment overrides", () => {
  setEnv({
    NODE_ENV: "development",
    AUTH_PASSWORD_MIN_LENGTH: "10",
    AUTH_PASSWORD_REQUIRE_UPPERCASE: "false",
    AUTH_PASSWORD_REQUIRE_LOWERCASE: "true",
    AUTH_PASSWORD_REQUIRE_DIGIT: "false"
  });

  const policy = getPasswordPolicyConfig();
  assert.deepEqual(policy, {
    minLength: 10,
    requireUppercase: false,
    requireLowercase: true,
    requireDigit: false
  });

  const result = validatePasswordPolicy("lowercase");
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["password must be at least 10 characters"]);
});

test("hashPassword produces scrypt hash that verifyPassword accepts", () => {
  const hashed = hashPassword("Strong123");
  assert.equal(isScryptHash(hashed), true);
  assert.equal(verifyPassword("Strong123", hashed), true);
  assert.equal(verifyPassword("Wrong123", hashed), false);
});

test("legacy plain passwords are disabled by default in production", () => {
  setEnv({
    NODE_ENV: "production",
    ALLOW_LEGACY_PLAIN_PASSWORDS: undefined
  });

  assert.equal(allowLegacyPlainPasswords(), false);
  assert.equal(verifyPassword("Strong123", "plain:Strong123"), false);
});

test("normalizeBootstrapPassword preserves hashes and rehashes plain passwords when legacy plain auth is disabled", () => {
  setEnv({
    NODE_ENV: "production",
    ALLOW_LEGACY_PLAIN_PASSWORDS: undefined
  });

  const existingHash = hashPassword("Strong123");
  assert.equal(normalizeBootstrapPassword(existingHash), existingHash);

  const normalized = normalizeBootstrapPassword("plain:Strong123");
  assert.equal(normalized === "plain:Strong123", false);
  assert.equal(isScryptHash(normalized), true);
  assert.equal(verifyPassword("Strong123", normalized), true);
});

test("normalizeBootstrapPassword can preserve plain bootstrap password when explicitly allowed", () => {
  setEnv({
    NODE_ENV: "development",
    ALLOW_LEGACY_PLAIN_PASSWORDS: "true"
  });

  assert.equal(normalizeBootstrapPassword("plain:Strong123"), "plain:Strong123");
  assert.equal(verifyPassword("Strong123", "plain:Strong123"), true);
});
