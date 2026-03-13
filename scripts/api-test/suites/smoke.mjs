import assert from "node:assert/strict";

function createLocalTestEmail(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@local.test`;
}

export async function runSmokeSuite(context) {
  const { apiFetch, cookieJar, baseUrl } = context;

  const liveness = await apiFetch("/api/health", { useCookies: false });
  assert.equal(liveness.status, 200, `GET /api/health failed: ${liveness.raw}`);
  assert.equal(liveness.body?.code, 0, "Liveness response should use standard envelope");
  assert.equal(liveness.body?.alive, true, "Liveness response should expose alive=true");
  assert.equal(liveness.body?.mode, "liveness", "Liveness response should expose mode=liveness");

  const readiness = await apiFetch("/api/health/readiness", { useCookies: false });
  assert.equal(readiness.status, 200, `GET /api/health/readiness failed: ${readiness.raw}`);
  assert.equal(readiness.body?.code, 0, "Readiness response should use standard envelope");
  assert.equal(readiness.body?.ready, true, "Readiness response should be ready in test runtime");
  assert.equal(readiness.body?.mode, "readiness", "Readiness response should expose mode=readiness");
  assert.ok(Array.isArray(readiness.body?.data?.checks), "Readiness should expose dependency checks");
  assert.ok(
    readiness.body?.data?.checks?.some((item) => item.name === "database"),
    "Readiness should include database check"
  );
  assert.ok(
    readiness.body?.data?.checks?.some((item) => item.name === "objectStorage"),
    "Readiness should include object storage check"
  );

  const passwordPolicy = await apiFetch("/api/auth/password-policy", { useCookies: false });
  assert.equal(passwordPolicy.status, 200, `GET /api/auth/password-policy failed: ${passwordPolicy.raw}`);

  const email = createLocalTestEmail("api-test-smoke");
  const password = "ApiTest123!";
  const register = await apiFetch("/api/auth/register", {
    method: "POST",
    useCookies: false,
    json: {
      role: "student",
      email,
      password,
      name: "Smoke Student",
      grade: "4"
    }
  });
  assert.equal(register.status, 201, `Smoke registration failed: ${register.raw}`);

  const login = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: {
      email,
      password,
      role: "student"
    }
  });
  assert.equal(login.status, 200, `Smoke login failed: ${login.raw}`);
  assert.ok(cookieJar.has("mvp_session"), "Smoke login should set session cookie");

  const me = await apiFetch("/api/auth/me");
  assert.equal(me.status, 200, `GET /api/auth/me failed after smoke login: ${me.raw}`);
  assert.equal(me.body?.user?.email ?? me.body?.data?.user?.email, email, "Smoke auth session should resolve current user");

  const logout = await apiFetch("/api/auth/logout", {
    method: "POST",
    referrer: `${baseUrl}/smoke`
  });
  assert.equal(logout.status, 200, `Smoke logout failed: ${logout.raw}`);
}
