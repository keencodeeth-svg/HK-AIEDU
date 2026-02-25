import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.API_TEST_PORT || 3210);
const baseUrl = `http://127.0.0.1:${port}`;
const cookieJar = new Map();

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function updateCookieJar(response) {
  const getSetCookie = response.headers.getSetCookie;
  const rawCookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(response.headers)
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : [];

  rawCookies.forEach((raw) => {
    const first = String(raw).split(";")[0]?.trim();
    if (!first || !first.includes("=")) return;
    const [name, ...rest] = first.split("=");
    cookieJar.set(name, rest.join("="));
  });
}

function buildCookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function apiFetch(path, options = {}) {
  const { json, useCookies = true, ...rest } = options;
  const headers = new Headers(rest.headers ?? {});

  if (json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (useCookies) {
    const cookie = buildCookieHeader();
    if (cookie) {
      headers.set("cookie", cookie);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body
  });

  updateCookieJar(response);
  const text = await response.text();
  const body = parseJsonSafely(text);
  return { status: response.status, body, raw: text };
}

async function waitForServerReady(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error(`Server not ready in ${timeoutMs}ms`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  try {
    await Promise.race([once(server, "exit"), delay(5000)]);
  } catch {
    // ignore
  }
  if (server.exitCode === null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

async function run() {
  const server = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverLog = "";
  server.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  let createdKnowledgePointId = null;
  let createdQuestionId = null;

  try {
    await waitForServerReady();

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

    const email = process.env.API_TEST_EMAIL || "api-test-student@local.test";
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

    const invalidNotification = await apiFetch("/api/notifications", {
      method: "POST",
      json: {}
    });
    assert.equal(invalidNotification.status, 400, "POST /api/notifications should validate body");
    assert.equal(invalidNotification.body?.error, "missing id");

    const createCorrection = await apiFetch("/api/corrections", {
      method: "POST",
      json: { questionIds: ["q-non-existent-for-test"] }
    });
    assert.equal(createCorrection.status, 200, `POST /api/corrections failed: ${createCorrection.raw}`);
    assert.ok(Array.isArray(createCorrection.body?.created), "Response should keep top-level created");
    assert.ok(Array.isArray(createCorrection.body?.skipped), "Response should keep top-level skipped");

    const listCorrections = await apiFetch("/api/corrections");
    assert.equal(listCorrections.status, 200, `GET /api/corrections failed: ${listCorrections.raw}`);
    assert.ok(Array.isArray(listCorrections.body?.data), "Corrections response should include data array");
    assert.ok(listCorrections.body?.summary && typeof listCorrections.body.summary === "object");

    const classList = await apiFetch("/api/classes");
    assert.equal(classList.status, 200, `GET /api/classes failed: ${classList.raw}`);
    assert.ok(Array.isArray(classList.body?.data), "Classes response should include data array");

    const invalidThread = await apiFetch("/api/inbox/threads", {
      method: "POST",
      json: {}
    });
    assert.equal(invalidThread.status, 400, "POST /api/inbox/threads should validate body");
    assert.equal(invalidThread.body?.error, "missing fields");

    const studentAdminLogs = await apiFetch("/api/admin/logs");
    assert.equal(studentAdminLogs.status, 401, "Student should not access /api/admin/logs");
    assert.equal(studentAdminLogs.body?.error, "unauthorized");

    const studentFunnel = await apiFetch("/api/analytics/funnel");
    assert.equal(studentFunnel.status, 401, "Student should not access /api/analytics/funnel");
    assert.equal(studentFunnel.body?.error, "unauthorized");

    const practiceNext = await apiFetch("/api/practice/next", {
      method: "POST",
      json: { subject: "math", grade: "4" }
    });
    assert.equal(practiceNext.status, 200, `POST /api/practice/next failed: ${practiceNext.raw}`);
    assert.ok(practiceNext.body?.question?.id, "Practice next should return question.id");

    const practiceSubmit = await apiFetch("/api/practice/submit", {
      method: "POST",
      json: {
        questionId: practiceNext.body.question.id,
        answer: practiceNext.body.question.options?.[0] ?? "A"
      }
    });
    assert.equal(practiceSubmit.status, 200, `POST /api/practice/submit failed: ${practiceSubmit.raw}`);
    assert.equal(typeof practiceSubmit.body?.masteryScore, "number", "Practice submit should return masteryScore");
    assert.equal(typeof practiceSubmit.body?.masteryDelta, "number", "Practice submit should return masteryDelta");
    assert.equal(
      practiceSubmit.body?.knowledgePointId,
      practiceNext.body?.question?.knowledgePointId,
      "Practice submit should return knowledgePointId"
    );
    assert.ok(practiceSubmit.body?.mastery && typeof practiceSubmit.body.mastery === "object");

    const studentPlan = await apiFetch("/api/plan?subject=math");
    assert.equal(studentPlan.status, 200, `GET /api/plan failed: ${studentPlan.raw}`);
    const planItems = studentPlan.body?.data?.items ?? studentPlan.body?.items ?? [];
    assert.ok(Array.isArray(planItems), "Plan response should include items");
    if (planItems.length > 0) {
      assert.equal(typeof planItems[0]?.masteryScore, "number", "Plan item should include masteryScore");
    }

    const studentRadar = await apiFetch("/api/student/radar");
    assert.equal(studentRadar.status, 200, `GET /api/student/radar failed: ${studentRadar.raw}`);
    assert.ok(Array.isArray(studentRadar.body?.data?.abilities), "Radar response should include abilities");
    assert.equal(
      typeof studentRadar.body?.data?.mastery?.averageMasteryScore,
      "number",
      "Radar response should include mastery.averageMasteryScore"
    );
    assert.ok(
      Array.isArray(studentRadar.body?.data?.mastery?.weakKnowledgePoints),
      "Radar response should include mastery.weakKnowledgePoints"
    );

    const adminEmail = process.env.API_TEST_ADMIN_EMAIL || "admin@demo.com";
    const adminPassword = process.env.API_TEST_ADMIN_PASSWORD || "Admin123";
    const adminLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: adminEmail, password: adminPassword, role: "admin" }
    });
    assert.equal(adminLogin.status, 200, `Admin login failed: ${adminLogin.raw}`);
    assert.ok(cookieJar.has("mvp_session"), "Admin login should set mvp_session cookie");

    const adminLogs = await apiFetch("/api/admin/logs?limit=5");
    assert.equal(adminLogs.status, 200, `GET /api/admin/logs failed: ${adminLogs.raw}`);
    assert.equal(adminLogs.body?.code, 0, "Admin logs should use standard envelope");
    assert.ok(Array.isArray(adminLogs.body?.data), "Admin logs response should include data array");

    const funnelSessionId = `api-test-funnel-${Date.now().toString(36)}`;
    const funnelSeed = await apiFetch("/api/analytics/events", {
      method: "POST",
      json: {
        events: [
          { eventName: "login_page_view", page: "/login", sessionId: funnelSessionId },
          { eventName: "login_success", page: "/login", sessionId: funnelSessionId },
          { eventName: "practice_page_view", page: "/practice", sessionId: funnelSessionId },
          { eventName: "practice_submit_success", page: "/practice", sessionId: funnelSessionId },
          { eventName: "report_weekly_view", page: "/report", sessionId: funnelSessionId }
        ]
      }
    });
    assert.equal(funnelSeed.status, 200, `Funnel seed analytics failed: ${funnelSeed.raw}`);
    assert.equal(funnelSeed.body?.accepted, 5, "Funnel seed should accept 5 events");

    const funnel = await apiFetch("/api/analytics/funnel");
    assert.equal(funnel.status, 200, `GET /api/analytics/funnel failed: ${funnel.raw}`);
    assert.ok(Array.isArray(funnel.body?.data?.stages), "Funnel response should include stages");
    const stages = funnel.body.data.stages;
    assert.equal(stages.length, 5, "Funnel should include 5 configured stages");
    assert.ok(stages[0].users >= 1, "Funnel stage1 should have at least one actor");
    for (let i = 1; i < stages.length; i += 1) {
      assert.ok(stages[i - 1].users >= stages[i].users, "Funnel stages should be non-increasing");
    }

    const invalidKnowledgePointCreate = await apiFetch("/api/admin/knowledge-points", {
      method: "POST",
      json: {}
    });
    assert.equal(invalidKnowledgePointCreate.status, 400, "POST /api/admin/knowledge-points should validate body");
    assert.equal(invalidKnowledgePointCreate.body?.error, "missing fields");

    const invalidQuestionCreate = await apiFetch("/api/admin/questions", {
      method: "POST",
      json: {}
    });
    assert.equal(invalidQuestionCreate.status, 400, "POST /api/admin/questions should validate body");
    assert.equal(invalidQuestionCreate.body?.error, "missing fields");

    const invalidQuestionImport = await apiFetch("/api/admin/questions/import", {
      method: "POST",
      json: {}
    });
    assert.equal(invalidQuestionImport.status, 400, "POST /api/admin/questions/import should validate body");
    assert.equal(invalidQuestionImport.body?.error, "items required");

    const suffix = Date.now().toString(36);
    const createKnowledgePoint = await apiFetch("/api/admin/knowledge-points", {
      method: "POST",
      json: {
        subject: "math",
        grade: "4",
        title: `API_TEST_KP_${suffix}`,
        chapter: "API_TEST_CHAPTER",
        unit: "API_TEST_UNIT"
      }
    });
    assert.equal(createKnowledgePoint.status, 200, `Create knowledge point failed: ${createKnowledgePoint.raw}`);
    createdKnowledgePointId = createKnowledgePoint.body?.data?.id ?? null;
    assert.ok(createdKnowledgePointId, "Knowledge point creation should return data.id");

    const patchKnowledgePoint = await apiFetch(`/api/admin/knowledge-points/${createdKnowledgePointId}`, {
      method: "PATCH",
      json: { chapter: "API_TEST_CHAPTER_UPDATED" }
    });
    assert.equal(
      patchKnowledgePoint.status,
      200,
      `PATCH /api/admin/knowledge-points/[id] failed: ${patchKnowledgePoint.raw}`
    );
    assert.equal(
      patchKnowledgePoint.body?.data?.chapter,
      "API_TEST_CHAPTER_UPDATED",
      "Knowledge point patch should update chapter"
    );

    const createQuestion = await apiFetch("/api/admin/questions", {
      method: "POST",
      json: {
        subject: "math",
        grade: "4",
        knowledgePointId: createdKnowledgePointId,
        stem: `API_TEST_QUESTION_${suffix}`,
        options: ["A", "B", "C", "D"],
        answer: "A",
        explanation: "test",
        difficulty: "medium",
        questionType: "choice",
        tags: ["api-test"],
        abilities: ["comprehension"]
      }
    });
    assert.equal(createQuestion.status, 200, `Create question failed: ${createQuestion.raw}`);
    createdQuestionId = createQuestion.body?.data?.id ?? null;
    assert.ok(createdQuestionId, "Question creation should return data.id");

    const patchQuestion = await apiFetch(`/api/admin/questions/${createdQuestionId}`, {
      method: "PATCH",
      json: { explanation: "patched-by-api-test" }
    });
    assert.equal(patchQuestion.status, 200, `PATCH /api/admin/questions/[id] failed: ${patchQuestion.raw}`);
    assert.equal(
      patchQuestion.body?.data?.explanation,
      "patched-by-api-test",
      "Question patch should update explanation"
    );

    const deleteQuestion = await apiFetch(`/api/admin/questions/${createdQuestionId}`, {
      method: "DELETE"
    });
    assert.equal(deleteQuestion.status, 200, `DELETE /api/admin/questions/[id] failed: ${deleteQuestion.raw}`);
    assert.equal(deleteQuestion.body?.ok, true, "Delete question should return ok=true");
    createdQuestionId = null;

    const deleteKnowledgePoint = await apiFetch(`/api/admin/knowledge-points/${createdKnowledgePointId}`, {
      method: "DELETE"
    });
    assert.equal(
      deleteKnowledgePoint.status,
      200,
      `DELETE /api/admin/knowledge-points/[id] failed: ${deleteKnowledgePoint.raw}`
    );
    assert.equal(deleteKnowledgePoint.body?.ok, true, "Delete knowledge point should return ok=true");
    createdKnowledgePointId = null;

    console.log("API integration tests passed.");
  } catch (error) {
    console.error("API integration tests failed.");
    if (serverLog.trim()) {
      console.error("--- server log ---");
      console.error(serverLog.slice(-8000));
      console.error("--- end server log ---");
    }
    throw error;
  } finally {
    try {
      if (createdQuestionId) {
        await apiFetch(`/api/admin/questions/${createdQuestionId}`, { method: "DELETE" });
      }
    } catch {
      // cleanup best effort
    }

    try {
      if (createdKnowledgePointId) {
        await apiFetch(`/api/admin/knowledge-points/${createdKnowledgePointId}`, { method: "DELETE" });
      }
    } catch {
      // cleanup best effort
    }

    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
