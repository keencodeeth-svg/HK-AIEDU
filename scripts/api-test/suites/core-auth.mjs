import assert from "node:assert/strict";

function createLocalTestEmail(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@local.test`;
}

export async function runCoreAuthSuite(context) {
  const { apiFetch, cookieJar, state } = context;

  const health = await apiFetch("/api/health", { useCookies: false });
  assert.equal(health.status, 200, `GET /api/health failed: ${health.raw}`);
  assert.equal(health.body?.code, 0, "Health response should use standard envelope");
  assert.equal(health.body?.ok, true, "Health response should keep top-level ok=true");

  const passwordPolicy = await apiFetch("/api/auth/password-policy", { useCookies: false });
  assert.equal(passwordPolicy.status, 200, `GET /api/auth/password-policy failed: ${passwordPolicy.raw}`);
  assert.equal(passwordPolicy.body?.code, 0, "Password policy response should use standard envelope");
  assert.ok(passwordPolicy.body?.data?.policy, "Password policy should expose policy details");
  assert.ok(passwordPolicy.body?.hint, "Password policy response should expose top-level hint");
  assert.match(String(passwordPolicy.body?.hint ?? ""), /密码规则/, "Password policy hint should be human-readable");

  const invalidAnalytics = await apiFetch("/api/analytics/events", {
    method: "POST",
    useCookies: false,
    json: {}
  });
  assert.equal(invalidAnalytics.status, 400, "POST /api/analytics/events should validate body");
  assert.equal(invalidAnalytics.body?.error, "events required");

  const analytics = await apiFetch("/api/analytics/events", {
    method: "POST",
    useCookies: false,
    json: {
      events: [
        {
          eventName: "api_test_event",
          page: "/api-test"
        }
      ]
    }
  });
  assert.equal(analytics.status, 200, `POST /api/analytics/events failed: ${analytics.raw}`);
  assert.equal(analytics.body?.accepted, 1, "Analytics accepted count should be 1");
  assert.equal(analytics.body?.dropped, 0, "Analytics dropped count should be 0");

  const unauthNotifications = await apiFetch("/api/notifications", { useCookies: false });
  assert.equal(unauthNotifications.status, 401, "GET /api/notifications should require auth");
  assert.ok(unauthNotifications.body?.error, "Unauthorized response should include error");

  const unauthAdminLogs = await apiFetch("/api/admin/logs", { useCookies: false });
  assert.equal(unauthAdminLogs.status, 401, "GET /api/admin/logs should require admin auth");
  assert.equal(unauthAdminLogs.body?.error, "unauthorized");

  const unauthRecoveryWorkbench = await apiFetch("/api/admin/recovery-requests", { useCookies: false });
  assert.equal(unauthRecoveryWorkbench.status, 401, "GET /api/admin/recovery-requests should require admin auth");
  assert.equal(unauthRecoveryWorkbench.body?.error, "unauthorized");

  const unauthFunnel = await apiFetch("/api/analytics/funnel", { useCookies: false });
  assert.equal(unauthFunnel.status, 401, "GET /api/analytics/funnel should require admin auth");
  assert.equal(unauthFunnel.body?.error, "unauthorized");

  const weakPasswordRegister = await apiFetch("/api/auth/register", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email: createLocalTestEmail("api-test-weak-password"),
      password: "weak",
      name: "Weak Password Student",
      grade: "4"
    }
  });
  assert.equal(weakPasswordRegister.status, 400, "Weak password should be rejected");
  assert.match(
    String(weakPasswordRegister.body?.error ?? ""),
    /password must/i,
    `Weak password error should explain the policy: ${weakPasswordRegister.raw}`
  );
  assert.ok(weakPasswordRegister.body?.details?.passwordPolicy, "Weak password response should expose password policy");

  const feedbackEmail = createLocalTestEmail("api-test-login-feedback");
  const feedbackPassword = "ApiTest123!";
  const feedbackHeaders = { "x-forwarded-for": "203.0.113.24" };
  const registerForFeedback = await apiFetch("/api/auth/register", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email: feedbackEmail,
      password: feedbackPassword,
      name: "Feedback Student",
      grade: "5"
    }
  });
  assert.equal(registerForFeedback.status, 201, `Feedback test registration failed: ${registerForFeedback.raw}`);

  const firstFailedLogin = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: feedbackHeaders,
    json: { email: feedbackEmail, password: `${feedbackPassword}-wrong`, role: "student" }
  });
  assert.equal(firstFailedLogin.status, 401, `First failed login should be unauthorized: ${firstFailedLogin.raw}`);
  assert.equal(firstFailedLogin.body?.error, "邮箱或密码错误");
  assert.equal(firstFailedLogin.body?.details?.failedCount, 1, "First failed login should increment failedCount");
  assert.equal(
    firstFailedLogin.body?.details?.remainingAttempts,
    (firstFailedLogin.body?.details?.maxFailedAttempts ?? 0) - 1,
    "First failed login should expose remaining attempts"
  );

  const successfulAfterFailure = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: feedbackHeaders,
    json: { email: feedbackEmail, password: feedbackPassword, role: "student" }
  });
  assert.equal(successfulAfterFailure.status, 200, `Correct password should clear login attempt state: ${successfulAfterFailure.raw}`);

  const failedAfterReset = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: feedbackHeaders,
    json: { email: feedbackEmail, password: `${feedbackPassword}-wrong`, role: "student" }
  });
  assert.equal(failedAfterReset.status, 401, `Failed login after successful reset should still be unauthorized: ${failedAfterReset.raw}`);
  assert.equal(failedAfterReset.body?.details?.failedCount, 1, "Successful login should reset failedCount");
  assert.equal(
    failedAfterReset.body?.details?.remainingAttempts,
    firstFailedLogin.body?.details?.remainingAttempts,
    "Successful login should reset remaining attempts back to the first-failure value"
  );

  const lockEmail = createLocalTestEmail("api-test-lockout");
  const lockPassword = "ApiTest123!";
  const registerForLockout = await apiFetch("/api/auth/register", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email: lockEmail,
      password: lockPassword,
      name: "Lockout Student",
      grade: "5"
    }
  });
  assert.equal(registerForLockout.status, 201, `Lockout test registration failed: ${registerForLockout.raw}`);

  const lockHeaders = { "x-forwarded-for": "203.0.113.25" };
  const initialLockFailure = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: lockHeaders,
    json: { email: lockEmail, password: `${lockPassword}-wrong`, role: "student" }
  });
  assert.equal(initialLockFailure.status, 401, `First lockout failure should be unauthorized: ${initialLockFailure.raw}`);
  const maxFailedAttempts = Number(initialLockFailure.body?.details?.maxFailedAttempts ?? 0);
  assert.ok(maxFailedAttempts >= 3, "Lockout policy should expose maxFailedAttempts");
  assert.equal(
    initialLockFailure.body?.details?.remainingAttempts,
    maxFailedAttempts - 1,
    "First lockout failure should expose remaining attempts"
  );

  for (let attempt = 2; attempt < maxFailedAttempts; attempt += 1) {
    const failedLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      headers: lockHeaders,
      json: { email: lockEmail, password: `${lockPassword}-wrong`, role: "student" }
    });
    assert.equal(failedLogin.status, 401, `Failed login #${attempt} should stay unauthorized: ${failedLogin.raw}`);
    assert.equal(failedLogin.body?.details?.failedCount, attempt, `Failed login #${attempt} should increment failedCount`);
    assert.equal(
      failedLogin.body?.details?.remainingAttempts,
      maxFailedAttempts - attempt,
      `Failed login #${attempt} should reduce remaining attempts`
    );
  }

  const thresholdLogin = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: lockHeaders,
    json: { email: lockEmail, password: `${lockPassword}-wrong`, role: "student" }
  });
  assert.equal(thresholdLogin.status, 429, `Threshold login should trigger lockout: ${thresholdLogin.raw}`);
  assert.equal(thresholdLogin.body?.error, "登录失败次数过多，请稍后再试");
  assert.equal(thresholdLogin.body?.details?.failedCount, maxFailedAttempts, "Lockout response should keep final failedCount");
  assert.equal(thresholdLogin.body?.details?.remainingAttempts, 0, "Lockout response should expose zero remaining attempts");
  assert.ok(thresholdLogin.body?.details?.lockUntil, "Lockout response should expose lockUntil");

  const lockedEvenWithCorrectPassword = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: lockHeaders,
    json: { email: lockEmail, password: lockPassword, role: "student" }
  });
  assert.equal(
    lockedEvenWithCorrectPassword.status,
    429,
    `Locked account should remain blocked before the lock window expires: ${lockedEvenWithCorrectPassword.raw}`
  );
  assert.equal(lockedEvenWithCorrectPassword.body?.details?.remainingAttempts, 0, "Locked account should remain at zero remaining attempts");

  const invalidRecoveryRequest = await apiFetch("/api/auth/recovery-request", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email: "   ",
      issueType: "forgot_password"
    }
  });
  assert.equal(invalidRecoveryRequest.status, 400, `Blank recovery email should be rejected: ${invalidRecoveryRequest.raw}`);
  assert.equal(invalidRecoveryRequest.body?.error, "email required");

  const recoveryEmail = createLocalTestEmail("api-test-recovery");
  const firstRecoveryRequest = await apiFetch("/api/auth/recovery-request", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email: recoveryEmail,
      issueType: "forgot_password",
      name: "Recovery Student",
      note: "忘记密码，无法登录"
    }
  });
  assert.equal(firstRecoveryRequest.status, 200, `Recovery request should be accepted: ${firstRecoveryRequest.raw}`);
  assert.equal(firstRecoveryRequest.body?.code, 0, "Recovery request should use standard envelope");
  assert.ok(firstRecoveryRequest.body?.data?.ticketId, "Recovery request should return a ticketId");
  assert.equal(firstRecoveryRequest.body?.data?.duplicate, false, "First recovery request should not be marked duplicate");
  assert.match(String(firstRecoveryRequest.body?.message ?? ""), /已受理恢复请求/, "Recovery request should return generic acceptance copy");
  assert.ok(Array.isArray(firstRecoveryRequest.body?.data?.nextSteps), "Recovery request should return next steps");
  assert.ok(firstRecoveryRequest.body?.data?.nextSteps.length >= 2, "Recovery request should provide actionable next steps");

  const duplicateRecoveryRequest = await apiFetch("/api/auth/recovery-request", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email: recoveryEmail,
      issueType: "forgot_password",
      name: "Recovery Student",
      note: "忘记密码，无法登录"
    }
  });
  assert.equal(duplicateRecoveryRequest.status, 200, `Duplicate recovery request should still be accepted: ${duplicateRecoveryRequest.raw}`);
  assert.equal(duplicateRecoveryRequest.body?.code, 0, "Duplicate recovery request should still use standard envelope");
  assert.equal(duplicateRecoveryRequest.body?.data?.duplicate, true, "Second identical recovery request should be marked duplicate");
  assert.equal(
    duplicateRecoveryRequest.body?.data?.ticketId,
    firstRecoveryRequest.body?.data?.ticketId,
    "Duplicate recovery request should reuse the original ticketId"
  );
  assert.match(String(duplicateRecoveryRequest.body?.message ?? ""), /相同恢复请求/, "Duplicate recovery request should acknowledge prior submission");

  const email = process.env.API_TEST_EMAIL || createLocalTestEmail("api-test-student");
  const password = process.env.API_TEST_PASSWORD || "ApiTest123!";

  let login = await apiFetch("/api/auth/login", {
    method: "POST",
    json: { email, password, role: "student" }
  });

  if (login.status !== 200) {
    const register = await apiFetch("/api/auth/register", {
      method: "POST",
      useCookies: false,
      json: {
        role: "student",
        email,
        password,
        name: "API Test Student",
        grade: "4"
      }
    });
    assert.equal(register.status, 201, `Register failed: ${register.raw}`);

    login = await apiFetch("/api/auth/login", {
      method: "POST",
      json: { email, password, role: "student" }
    });
  }

  assert.equal(login.status, 200, `Login failed: ${login.raw}`);
  assert.ok(cookieJar.has("mvp_session"), "Login should set mvp_session cookie");

  state.email = email;
  state.password = password;
}
