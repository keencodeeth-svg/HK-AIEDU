import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectInviteCodes,
  decideSelfRegisterAccess,
  isInitialSelfRegisterEnabled,
  normalizeInviteCode
} from "../../lib/self-register-policy";

test("normalizeInviteCode strips separators and normalizes case", () => {
  assert.equal(normalizeInviteCode(" hk-teach-2026 "), "HKTEACH2026");
});

test("collectInviteCodes ignores blanks and normalizes configured values", () => {
  const codes = collectInviteCodes([" HK-TEACH-2026 ", "", undefined, "hk teach 2026 b"]);
  assert.deepEqual(Array.from(codes), ["HKTEACH2026", "HKTEACH2026B"]);
});

test("bootstrap self-register requires explicit flag even when account count is zero", () => {
  const decision = decideSelfRegisterAccess({
    existingCount: 0,
    inputInviteCode: "",
    configuredInviteCodes: [],
    bootstrapEnabled: false
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.error, "invite code required");
});

test("bootstrap self-register only allows the first account when explicitly enabled", () => {
  const firstDecision = decideSelfRegisterAccess({
    existingCount: 0,
    inputInviteCode: "",
    configuredInviteCodes: [],
    bootstrapEnabled: true
  });
  assert.equal(firstDecision.accepted, true);
  assert.equal(firstDecision.allowBootstrap, true);

  const laterDecision = decideSelfRegisterAccess({
    existingCount: 1,
    inputInviteCode: "",
    configuredInviteCodes: [],
    bootstrapEnabled: true
  });
  assert.equal(laterDecision.accepted, false);
  assert.equal(laterDecision.error, "invite code required");
});

test("configured invite codes take precedence over bootstrap mode", () => {
  const missingInvite = decideSelfRegisterAccess({
    existingCount: 0,
    inputInviteCode: "",
    configuredInviteCodes: ["HK-ADMIN-2026"],
    bootstrapEnabled: true
  });
  assert.equal(missingInvite.accepted, false);
  assert.equal(missingInvite.error, "invite code required");

  const invalidInvite = decideSelfRegisterAccess({
    existingCount: 0,
    inputInviteCode: "wrong-code",
    configuredInviteCodes: ["HK-ADMIN-2026"],
    bootstrapEnabled: true
  });
  assert.equal(invalidInvite.accepted, false);
  assert.equal(invalidInvite.error, "invalid invite code");

  const validInvite = decideSelfRegisterAccess({
    existingCount: 0,
    inputInviteCode: "hk-admin-2026",
    configuredInviteCodes: ["HK-ADMIN-2026"],
    bootstrapEnabled: true
  });
  assert.equal(validInvite.accepted, true);
  assert.equal(validInvite.requireInvite, true);
});

test("isInitialSelfRegisterEnabled only accepts explicit truthy values", () => {
  assert.equal(isInitialSelfRegisterEnabled("true"), true);
  assert.equal(isInitialSelfRegisterEnabled("1"), true);
  assert.equal(isInitialSelfRegisterEnabled("false"), false);
  assert.equal(isInitialSelfRegisterEnabled(undefined), false);
});
