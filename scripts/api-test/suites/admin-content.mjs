import assert from "node:assert/strict";

export async function runAdminContentSuite(context) {
  const { apiFetch, state } = context;

  const adminEmail = process.env.API_TEST_ADMIN_EMAIL || "admin@demo.com";
  const adminPassword = process.env.API_TEST_ADMIN_PASSWORD || "Admin123";
  const adminLogin = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email: adminEmail, password: adminPassword, role: "admin" }
  });
  assert.equal(adminLogin.status, 200, `Admin login failed: ${adminLogin.raw}`);
  assert.ok(context.cookieJar.has("mvp_session"), "Admin login should set mvp_session cookie");

  const adminLogs = await apiFetch("/api/admin/logs?limit=5");
  assert.equal(adminLogs.status, 200, `GET /api/admin/logs failed: ${adminLogs.raw}`);
  assert.equal(adminLogs.body?.code, 0, "Admin logs should use standard envelope");
  assert.ok(Array.isArray(adminLogs.body?.data), "Admin logs response should include data array");

  const observabilityMetrics = await apiFetch("/api/admin/observability/metrics?limit=5");
  assert.equal(
    observabilityMetrics.status,
    200,
    `GET /api/admin/observability/metrics failed: ${observabilityMetrics.raw}`
  );
  assert.equal(
    typeof observabilityMetrics.body?.data?.totalRequests,
    "number",
    "Observability metrics should include totalRequests"
  );
  assert.ok(Array.isArray(observabilityMetrics.body?.data?.routes), "Observability metrics should include routes");

  const experimentFlags = await apiFetch("/api/admin/experiments/flags");
  assert.equal(
    experimentFlags.status,
    200,
    `GET /api/admin/experiments/flags failed: ${experimentFlags.raw}`
  );
  assert.ok(Array.isArray(experimentFlags.body?.data), "Experiment flags should include data array");
  const challengeFlag = (experimentFlags.body?.data ?? []).find(
    (item) => item.key === "challenge_learning_loop_v2"
  );
  assert.ok(challengeFlag, "challenge_learning_loop_v2 flag should exist");

  const updateExperimentFlag = await apiFetch("/api/admin/experiments/flags", {
    method: "POST",
    json: {
      key: "challenge_learning_loop_v2",
      enabled: challengeFlag.enabled,
      rollout: challengeFlag.rollout
    }
  });
  assert.equal(
    updateExperimentFlag.status,
    200,
    `POST /api/admin/experiments/flags failed: ${updateExperimentFlag.raw}`
  );
  assert.equal(
    updateExperimentFlag.body?.data?.key,
    "challenge_learning_loop_v2",
    "Updated experiment flag should match target key"
  );

  const abReport = await apiFetch("/api/admin/experiments/ab-report?days=7");
  assert.equal(
    abReport.status,
    200,
    `GET /api/admin/experiments/ab-report failed: ${abReport.raw}`
  );
  assert.ok(Array.isArray(abReport.body?.data?.variants), "A/B report should include variants");
  assert.equal(typeof abReport.body?.data?.delta?.retentionRate, "number");
  assert.equal(typeof abReport.body?.data?.recommendation?.suggestedRollout, "number");

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

  const invalidQualityCheck = await apiFetch("/api/admin/questions/quality-check", {
    method: "POST",
    json: {}
  });
  assert.equal(invalidQualityCheck.status, 400, "POST /api/admin/questions/quality-check should validate body");
  assert.equal(invalidQualityCheck.body?.error, "missing fields");

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
  state.createdKnowledgePointId = createKnowledgePoint.body?.data?.id ?? null;
  assert.ok(state.createdKnowledgePointId, "Knowledge point creation should return data.id");

  const patchKnowledgePoint = await apiFetch(`/api/admin/knowledge-points/${state.createdKnowledgePointId}`, {
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
      knowledgePointId: state.createdKnowledgePointId,
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
  state.createdQuestionId = createQuestion.body?.data?.id ?? null;
  assert.ok(state.createdQuestionId, "Question creation should return data.id");
  state.createdQuestionIds.add(state.createdQuestionId);
  assert.equal(
    typeof createQuestion.body?.data?.qualityScore,
    "number",
    "Create question should include qualityScore"
  );
  assert.equal(
    typeof createQuestion.body?.data?.answerConsistency,
    "number",
    "Create question should include answerConsistency"
  );

  const knowledgePointList = await apiFetch(
    "/api/admin/knowledge-points?subject=math&grade=4&page=1&pageSize=10"
  );
  assert.equal(
    knowledgePointList.status,
    200,
    `GET /api/admin/knowledge-points with pagination failed: ${knowledgePointList.raw}`
  );
  assert.ok(Array.isArray(knowledgePointList.body?.data), "Knowledge point list should include data array");
  assert.equal(typeof knowledgePointList.body?.meta?.total, "number", "Knowledge point list should include meta");
  assert.ok(Array.isArray(knowledgePointList.body?.tree), "Knowledge point list should include classification tree");
  assert.ok(Array.isArray(knowledgePointList.body?.facets?.subjects), "Knowledge point list should include facets");

  const questionList = await apiFetch("/api/admin/questions?subject=math&grade=4&page=1&pageSize=10");
  assert.equal(questionList.status, 200, `GET /api/admin/questions with pagination failed: ${questionList.raw}`);
  assert.ok(Array.isArray(questionList.body?.data), "Question list should include data array");
  assert.equal(typeof questionList.body?.meta?.total, "number", "Question list should include meta");
  assert.ok(Array.isArray(questionList.body?.tree), "Question list should include classification tree");
  assert.ok(Array.isArray(questionList.body?.facets?.subjects), "Question list should include facets");
  assert.equal(typeof questionList.body?.data?.[0]?.qualityScore, "number", "Question list should include quality");
  const filteredQuestionList = await apiFetch(
    "/api/admin/questions?subject=math&grade=4&pool=active&riskLevel=low&answerConflict=no&page=1&pageSize=10"
  );
  assert.equal(
    filteredQuestionList.status,
    200,
    `GET /api/admin/questions with quality filters failed: ${filteredQuestionList.raw}`
  );
  assert.equal(filteredQuestionList.body?.filters?.pool, "active");
  assert.equal(filteredQuestionList.body?.filters?.riskLevel, "low");
  assert.equal(filteredQuestionList.body?.filters?.answerConflict, "no");

  const patchQuestion = await apiFetch(`/api/admin/questions/${state.createdQuestionId}`, {
    method: "PATCH",
    json: { explanation: "patched-by-api-test" }
  });
  assert.equal(patchQuestion.status, 200, `PATCH /api/admin/questions/[id] failed: ${patchQuestion.raw}`);
  assert.equal(
    patchQuestion.body?.data?.explanation,
    "patched-by-api-test",
    "Question patch should update explanation"
  );
  assert.equal(typeof patchQuestion.body?.data?.qualityScore, "number");

  const qualityCheck = await apiFetch("/api/admin/questions/quality-check", {
    method: "POST",
    json: { questionId: state.createdQuestionId }
  });
  assert.equal(qualityCheck.status, 200, `POST /api/admin/questions/quality-check failed: ${qualityCheck.raw}`);
  assert.equal(qualityCheck.body?.saved, true, "Quality check should save metric when questionId is provided");
  assert.equal(
    typeof qualityCheck.body?.data?.qualityScore,
    "number",
    "Quality check response should include qualityScore"
  );

  const qualityList = await apiFetch(`/api/admin/questions/quality?questionId=${state.createdQuestionId}`);
  assert.equal(qualityList.status, 200, `GET /api/admin/questions/quality failed: ${qualityList.raw}`);
  assert.ok(Array.isArray(qualityList.body?.data), "Quality list should include data array");
  assert.equal(qualityList.body?.data?.[0]?.questionId, state.createdQuestionId);
  assert.equal(
    typeof qualityList.body?.summary?.averageQualityScore,
    "number",
    "Quality list should include summary.averageQualityScore"
  );

  const isolateQuestion = await apiFetch("/api/admin/questions/quality/isolation", {
    method: "POST",
    json: {
      questionId: state.createdQuestionId,
      isolated: true,
      reason: ["api-test isolate"]
    }
  });
  assert.equal(
    isolateQuestion.status,
    200,
    `POST /api/admin/questions/quality/isolation isolate failed: ${isolateQuestion.raw}`
  );
  assert.equal(isolateQuestion.body?.data?.isolated, true);

  const isolatedQuestionList = await apiFetch(
    `/api/admin/questions?subject=math&grade=4&pool=isolated&page=1&pageSize=20`
  );
  assert.equal(
    isolatedQuestionList.status,
    200,
    `GET /api/admin/questions pool=isolated failed: ${isolatedQuestionList.raw}`
  );
  assert.equal(isolatedQuestionList.body?.filters?.pool, "isolated");
  const isolatedCreatedQuestion = (isolatedQuestionList.body?.data ?? []).find(
    (item) => item.id === state.createdQuestionId
  );
  assert.ok(isolatedCreatedQuestion, "Isolated question list should include manually isolated question");

  const unisolateQuestion = await apiFetch("/api/admin/questions/quality/isolation", {
    method: "POST",
    json: {
      questionId: state.createdQuestionId,
      isolated: false,
      reason: ["api-test unisolate"]
    }
  });
  assert.equal(
    unisolateQuestion.status,
    200,
    `POST /api/admin/questions/quality/isolation unisolate failed: ${unisolateQuestion.raw}`
  );
  assert.equal(unisolateQuestion.body?.data?.isolated, false);

  const importQuestion = await apiFetch("/api/admin/questions/import", {
    method: "POST",
    json: {
      items: [
        {
          subject: "math",
          grade: "4",
          knowledgePointId: state.createdKnowledgePointId,
          stem: `API_TEST_IMPORT_QUESTION_${suffix}`,
          options: ["A", "B", "C", "D"],
          answer: "B",
          explanation: "import quality test"
        }
      ]
    }
  });
  assert.equal(importQuestion.status, 200, `POST /api/admin/questions/import failed: ${importQuestion.raw}`);
  assert.equal(importQuestion.body?.created, 1, "Question import should create one item");
  assert.ok(Array.isArray(importQuestion.body?.items), "Question import should return items array");
  const importedItem = importQuestion.body?.items?.[0];
  assert.ok(importedItem?.id, "Imported item should include id");
  assert.equal(typeof importedItem?.qualityScore, "number", "Imported item should include qualityScore");
  state.createdQuestionIds.add(importedItem.id);

  const deleteQuestion = await apiFetch(`/api/admin/questions/${state.createdQuestionId}`, {
    method: "DELETE"
  });
  assert.equal(deleteQuestion.status, 200, `DELETE /api/admin/questions/[id] failed: ${deleteQuestion.raw}`);
  assert.equal(deleteQuestion.body?.ok, true, "Delete question should return ok=true");
  state.createdQuestionIds.delete(state.createdQuestionId);
  state.createdQuestionId = null;

  for (const questionId of Array.from(state.createdQuestionIds)) {
    const cleanupQuestion = await apiFetch(`/api/admin/questions/${questionId}`, {
      method: "DELETE"
    });
    assert.equal(cleanupQuestion.status, 200, `Cleanup delete question failed: ${cleanupQuestion.raw}`);
    state.createdQuestionIds.delete(questionId);
  }

  const deleteKnowledgePoint = await apiFetch(`/api/admin/knowledge-points/${state.createdKnowledgePointId}`, {
    method: "DELETE"
  });
  assert.equal(
    deleteKnowledgePoint.status,
    200,
    `DELETE /api/admin/knowledge-points/[id] failed: ${deleteKnowledgePoint.raw}`
  );
  assert.equal(deleteKnowledgePoint.body?.ok, true, "Delete knowledge point should return ok=true");
  state.createdKnowledgePointId = null;
}
