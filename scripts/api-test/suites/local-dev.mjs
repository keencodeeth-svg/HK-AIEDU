import assert from "node:assert/strict";

export async function runLocalDevSuite(context) {
  const { apiFetch, cookieJar, baseUrl } = context;

  const liveness = await apiFetch("/api/health", { useCookies: false });
  assert.equal(liveness.status, 200, `GET /api/health failed: ${liveness.raw}`);

  const analytics = await apiFetch("/api/analytics/events", {
    method: "POST",
    useCookies: false,
    json: {
      events: [
        {
          eventName: "local_dev_contract",
          page: "/login"
        }
      ]
    }
  });
  assert.equal(analytics.status, 200, `POST /api/analytics/events failed: ${analytics.raw}`);
  assert.equal(analytics.body?.accepted, 1, "Local dev analytics should accept one event");
  assert.equal(analytics.body?.dropped, 0, "Local dev analytics should not drop seeded contract event");

  const login = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    referrer: `${baseUrl}/login?role=student`,
    json: {
      email: "student@demo.com",
      password: "Student123",
      role: "student"
    }
  });
  assert.equal(login.status, 200, `Demo student login failed in local dev mode: ${login.raw}`);
  assert.equal(login.body?.role ?? login.body?.data?.role, "student", "Demo login should resolve student role");
  assert.ok(cookieJar.has("mvp_session"), "Demo login should set session cookie in local dev mode");

  const me = await apiFetch("/api/auth/me");
  assert.equal(me.status, 200, `GET /api/auth/me failed after demo login: ${me.raw}`);
  assert.equal(
    me.body?.user?.email ?? me.body?.data?.user?.email,
    "student@demo.com",
    "Demo login should resolve seeded student account"
  );

  const logout = await apiFetch("/api/auth/logout", {
    method: "POST",
    referrer: `${baseUrl}/login`
  });
  assert.equal(logout.status, 200, `POST /api/auth/logout failed after demo login: ${logout.raw}`);
}
