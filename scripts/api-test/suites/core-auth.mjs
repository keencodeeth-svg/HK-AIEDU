import assert from "node:assert/strict";

export async function runCoreAuthSuite(context) {
  const { apiFetch, cookieJar, state } = context;

  const health = await apiFetch("/api/health", { useCookies: false });
  assert.equal(health.status, 200, `GET /api/health failed: ${health.raw}`);
  assert.equal(health.body?.code, 0, "Health response should use standard envelope");
  assert.equal(health.body?.ok, true, "Health response should keep top-level ok=true");

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

  const unauthFunnel = await apiFetch("/api/analytics/funnel", { useCookies: false });
  assert.equal(unauthFunnel.status, 401, "GET /api/analytics/funnel should require admin auth");
  assert.equal(unauthFunnel.body?.error, "unauthorized");

  const email = process.env.API_TEST_EMAIL || `api-test-student-${Date.now().toString(36)}@local.test`;
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
