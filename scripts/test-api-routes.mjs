import { createRuntime } from "./api-test/runtime.mjs";
import { runAdminContentSuite } from "./api-test/suites/admin-content.mjs";
import { runCoreAuthSuite } from "./api-test/suites/core-auth.mjs";
import { runLearningSuite } from "./api-test/suites/learning.mjs";
import { runTeacherExamSuite } from "./api-test/suites/teacher-exam.mjs";

const port = Number(process.env.API_TEST_PORT || 3210);
const runtime = createRuntime(port);

async function run() {
  const { server, getServerLog } = runtime.startServer();

  const state = {
    email: "",
    password: "",
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
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
