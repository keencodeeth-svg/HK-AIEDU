import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRuntime } from "./api-test/runtime.mjs";
import { runAdminContentSuite } from "./api-test/suites/admin-content.mjs";
import { runCoreAuthSuite } from "./api-test/suites/core-auth.mjs";
import { runLearningSuite } from "./api-test/suites/learning.mjs";
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
  const restoreMutableState = createMutableStateSnapshot();
  const { server, getServerLog } = runtime.startServer();
  const scope = (process.env.API_TEST_SCOPE ?? "full").toLowerCase();

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

  const context = {
    ...runtime,
    state
  };

  try {
    await runtime.waitForServerReady();

    if (scope === "health") {
      const health = await runtime.apiFetch("/api/health", { useCookies: false });
      if (health.status !== 200) {
        throw new Error(`Health check failed: ${health.status} ${health.raw}`);
      }
      console.log("API health tests passed.");
      return;
    }

    await runCoreAuthSuite(context);
    if (scope === "smoke") {
      console.log("API smoke tests passed.");
      return;
    }
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
        await runtime.apiFetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      } catch {
        // cleanup best effort
      }
    }

    try {
      if (state.createdKnowledgePointId) {
        await runtime.apiFetch(`/api/admin/knowledge-points/${state.createdKnowledgePointId}`, { method: "DELETE" });
      }
    } catch {
      // cleanup best effort
    }

    await runtime.stopServer(server);
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
