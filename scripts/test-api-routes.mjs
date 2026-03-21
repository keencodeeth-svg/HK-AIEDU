import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertApiTestBuildFreshness } from "./api-test/build-freshness.mjs";
import { createRuntime } from "./api-test/runtime.mjs";
import { runAdminContentSuite } from "./api-test/suites/admin-content.mjs";
import { runCoreAuthSuite } from "./api-test/suites/core-auth.mjs";
import { runLearningSuite } from "./api-test/suites/learning.mjs";
import { runLocalDevSuite } from "./api-test/suites/local-dev.mjs";
import { runSchoolScheduleSuite } from "./api-test/suites/school-schedules.mjs";
import { runSmokeSuite } from "./api-test/suites/smoke.mjs";
import { runTeacherExamSuite } from "./api-test/suites/teacher-exam.mjs";

const port = Number(process.env.API_TEST_PORT || 3210);
const runtime = createRuntime(port);
const SNAPSHOT_DIRS = ["data", ".runtime-data"];

function createMutableStateSnapshot() {
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hk-ai-edu-api-test-"));

  for (const directory of SNAPSHOT_DIRS) {
    const sourcePath = path.join(process.cwd(), directory);
    const targetPath = path.join(snapshotRoot, directory);
    if (fs.existsSync(sourcePath)) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    }
  }

  return () => {
    for (const directory of SNAPSHOT_DIRS) {
      const sourcePath = path.join(snapshotRoot, directory);
      const targetPath = path.join(process.cwd(), directory);
      fs.rmSync(targetPath, { recursive: true, force: true });
      if (fs.existsSync(sourcePath)) {
        fs.cpSync(sourcePath, targetPath, { recursive: true });
      }
    }
    fs.rmSync(snapshotRoot, { recursive: true, force: true });
  };
}

async function run() {
  const remoteSelfTest = process.env.API_TEST_REMOTE_SELF_TEST === "true";
  const scope = (process.env.API_TEST_SUITE ?? process.env.API_TEST_SCOPE ?? "full").toLowerCase();
  const requestedMode = process.env.API_TEST_SERVER_MODE;
  const isStartMode = requestedMode === "start";
  const restoreMutableState = runtime.isRemote ? () => {} : createMutableStateSnapshot();

  if (
    !runtime.isRemote &&
    isStartMode &&
    process.env.API_TEST_SKIP_BUILD_FRESHNESS_CHECK !== "true"
  ) {
    assertApiTestBuildFreshness(process.cwd());
  }

  const { server, getServerLog } = runtime.startServer();
  let activeRuntime = runtime;

  if (runtime.isRemote && scope !== "smoke" && scope !== "health" && process.env.API_TEST_ALLOW_REMOTE_FULL !== "true") {
    throw new Error(
      `Remote API test mode only allows smoke/health by default. Received API_TEST_SCOPE=${scope}. Set API_TEST_ALLOW_REMOTE_FULL=true to override intentionally.`
    );
  }

  if (remoteSelfTest && scope !== "smoke" && scope !== "health") {
    throw new Error(`API_TEST_REMOTE_SELF_TEST only supports smoke/health scope. Received API_TEST_SCOPE=${scope}.`);
  }

  const state = {
    email: "",
    password: "",
    observerCode: "",
    parentEmail: "",
    parentPassword: "",
    createdExamId: null,
    createdKnowledgePointId: null,
    createdQuestionId: null,
    createdQuestionIds: new Set()
  };

  try {
    await runtime.waitForServerReady();

    if (remoteSelfTest) {
      process.env.API_TEST_BASE_URL = runtime.baseUrl;
      activeRuntime = createRuntime(port);
      await activeRuntime.waitForServerReady();
    }

    const context = {
      ...activeRuntime,
      state
    };

    if (scope === "health") {
      const health = await activeRuntime.apiFetch("/api/health", { useCookies: false });
      if (health.status !== 200) {
        throw new Error(`Health liveness failed: ${health.status} ${health.raw}`);
      }
      const readiness = await activeRuntime.apiFetch("/api/health/readiness", { useCookies: false });
      if (readiness.status !== 200) {
        throw new Error(`Health readiness failed: ${readiness.status} ${readiness.raw}`);
      }
      console.log("API health tests passed.");
      return;
    }

    if (scope === "smoke") {
      await runSmokeSuite(context);
      console.log("API smoke tests passed.");
      return;
    }
    if (scope === "local-dev") {
      await runLocalDevSuite(context);
      console.log("Local dev contract tests passed.");
      return;
    }
    if (scope === "school-schedules") {
      await runSchoolScheduleSuite(context);
      console.log("School schedule API regression tests passed.");
      return;
    }
    await runCoreAuthSuite(context);
    await runLearningSuite(context);
    await runTeacherExamSuite(context);
    await runAdminContentSuite(context);

    console.log("API integration tests passed.");
  } catch (error) {
    console.error("API integration tests failed.");
    const serverLog = getServerLog();
    if (serverLog.trim()) {
      console.error("--- server log ---");
      console.error(serverLog.slice(-8000));
      console.error("--- end server log ---");
    }
    throw error;
  } finally {
    for (const questionId of state.createdQuestionIds) {
      try {
        await activeRuntime.apiFetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      } catch {
        // cleanup best effort
      }
    }

    try {
      if (state.createdKnowledgePointId) {
        await activeRuntime.apiFetch(`/api/admin/knowledge-points/${state.createdKnowledgePointId}`, { method: "DELETE" });
      }
    } catch {
      // cleanup best effort
    }

    await runtime.stopServer(server);
    if (remoteSelfTest) {
      delete process.env.API_TEST_BASE_URL;
    }
    restoreMutableState();
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
