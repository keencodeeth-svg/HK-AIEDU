import assert from "node:assert/strict";

export async function runLearningSuite(context) {
  const { apiFetch, state } = context;
  const { email, password } = state;

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

  const studentMetrics = await apiFetch("/api/admin/observability/metrics");
  assert.equal(studentMetrics.status, 401, "Student should not access /api/admin/observability/metrics");
  assert.equal(studentMetrics.body?.error, "unauthorized");

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
      answer: "__API_TEST_WRONG__"
    }
  });
  assert.equal(practiceSubmit.status, 200, `POST /api/practice/submit failed: ${practiceSubmit.raw}`);
  assert.equal(practiceSubmit.body?.correct, false, "Practice submit should be wrong with sentinel answer");
  assert.equal(typeof practiceSubmit.body?.masteryScore, "number", "Practice submit should return masteryScore");
  assert.equal(typeof practiceSubmit.body?.masteryDelta, "number", "Practice submit should return masteryDelta");
  assert.equal(
    practiceSubmit.body?.knowledgePointId,
    practiceNext.body?.question?.knowledgePointId,
    "Practice submit should return knowledgePointId"
  );
  assert.ok(practiceSubmit.body?.mastery && typeof practiceSubmit.body.mastery === "object");

  const challengeOverview = await apiFetch("/api/challenges");
  assert.equal(challengeOverview.status, 200, `GET /api/challenges failed: ${challengeOverview.raw}`);
  assert.ok(Array.isArray(challengeOverview.body?.data?.tasks), "Challenges should include tasks");
  assert.ok(
    challengeOverview.body?.data?.experiment && typeof challengeOverview.body.data.experiment === "object",
    "Challenges should include experiment info"
  );
  const challengeTasks = challengeOverview.body?.data?.tasks ?? [];
  assert.ok(challengeTasks.length >= 1, "Challenges should include at least one task");
  const firstChallengeTask = challengeTasks[0];
  assert.ok(
    Array.isArray(firstChallengeTask?.linkedKnowledgePoints),
    "Challenge task should include linkedKnowledgePoints"
  );
  assert.equal(typeof firstChallengeTask?.unlockRule, "string", "Challenge task should include unlockRule");
  assert.ok(
    firstChallengeTask?.learningProof && typeof firstChallengeTask.learningProof === "object",
    "Challenge task should include learningProof"
  );
  assert.ok(
    Array.isArray(firstChallengeTask?.learningProof?.missingActions),
    "Challenge learningProof should include missingActions"
  );

  const lockedChallengeTask = challengeTasks.find((task) => !task.completed && !task.claimed);
  assert.ok(lockedChallengeTask, "Should have at least one locked challenge task");
  const claimLockedChallenge = await apiFetch("/api/challenges/claim", {
    method: "POST",
    json: {
      taskId: lockedChallengeTask.id
    }
  });
  assert.equal(
    claimLockedChallenge.status,
    200,
    `POST /api/challenges/claim failed: ${claimLockedChallenge.raw}`
  );
  assert.equal(
    claimLockedChallenge.body?.data?.result?.ok,
    false,
    "Locked challenge task should not be claimable"
  );
  assert.ok(
    claimLockedChallenge.body?.data?.experiment &&
      typeof claimLockedChallenge.body.data.experiment === "object",
    "Challenge claim response should include experiment info"
  );

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

  const wrongBook = await apiFetch("/api/wrong-book");
  assert.equal(wrongBook.status, 200, `GET /api/wrong-book failed: ${wrongBook.raw}`);
  assert.ok(Array.isArray(wrongBook.body?.data), "Wrong-book response should include data array");
  const wrongItem = (wrongBook.body?.data ?? []).find((item) => item.id === practiceNext.body.question.id);
  assert.ok(wrongItem, "Wrong-book should include the latest wrong question");
  assert.equal(typeof wrongItem?.nextReviewAt, "string", "Wrong-book item should include nextReviewAt");
  assert.equal(wrongItem?.intervalLevel, 1, "Wrong-book item should start at intervalLevel 1");
  assert.equal(wrongItem?.lastReviewResult, "wrong", "Wrong-book item should mark lastReviewResult=wrong");

  const reviewQueue = await apiFetch("/api/wrong-book/review-queue");
  assert.equal(reviewQueue.status, 200, `GET /api/wrong-book/review-queue failed: ${reviewQueue.raw}`);
  assert.equal(typeof reviewQueue.body?.data?.summary?.dueToday, "number");
  const queueItems = [...(reviewQueue.body?.data?.today ?? []), ...(reviewQueue.body?.data?.upcoming ?? [])];
  const queueItem = queueItems.find((item) => item.questionId === practiceNext.body.question.id);
  assert.ok(queueItem, "Review queue should include newly wrong question");
  assert.equal(queueItem?.intervalLevel, 1, "Review queue item should start at intervalLevel 1");

  const reviewResult = await apiFetch("/api/wrong-book/review-result", {
    method: "POST",
    json: {
      questionId: practiceNext.body.question.id,
      answer: wrongItem.answer
    }
  });
  assert.equal(reviewResult.status, 200, `POST /api/wrong-book/review-result failed: ${reviewResult.raw}`);
  assert.equal(reviewResult.body?.correct, true, "Review result should accept correct answer");
  assert.equal(reviewResult.body?.intervalLevel, 2, "After one correct review, interval should move to level 2");
  assert.equal(typeof reviewResult.body?.nextReviewAt, "string", "Review result should include nextReviewAt");

  const weeklyReport = await apiFetch("/api/report/weekly");
  assert.equal(weeklyReport.status, 200, `GET /api/report/weekly failed: ${weeklyReport.raw}`);
  assert.ok(Array.isArray(weeklyReport.body?.actionItems), "Weekly report should include actionItems");
  assert.equal(typeof weeklyReport.body?.estimatedMinutes, "number", "Weekly report should include estimatedMinutes");
  assert.ok(Array.isArray(weeklyReport.body?.parentTips), "Weekly report should include parentTips");

  const parentCandidates = [
    {
      email: process.env.API_TEST_PARENT_EMAIL || "parent@demo.com",
      password: process.env.API_TEST_PARENT_PASSWORD || "Parent123"
    },
    {
      email: process.env.API_TEST_PARENT_FALLBACK_EMAIL || "parent1@demo.com",
      password: process.env.API_TEST_PARENT_FALLBACK_PASSWORD || "Parent123"
    }
  ];

  let parentLogin = null;
  for (const candidate of parentCandidates) {
    const resp = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: candidate.email, password: candidate.password, role: "parent" }
    });
    if (resp.status === 200) {
      parentLogin = resp;
      break;
    }
  }

  if (!parentLogin) {
    const tempParentEmail = `api-test-parent-${Date.now().toString(36)}@local.test`;
    const tempParentPassword = "ApiParent123!";
    const registerParent = await apiFetch("/api/auth/register", {
      method: "POST",
      useCookies: false,
      json: {
        role: "parent",
        email: tempParentEmail,
        password: tempParentPassword,
        name: "API Test Parent",
        studentEmail: email
      }
    });
    assert.equal(registerParent.status, 201, `Parent register failed: ${registerParent.raw}`);

    parentLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: tempParentEmail, password: tempParentPassword, role: "parent" }
    });
  }

  assert.equal(parentLogin?.status, 200, "Parent login failed");

  const parentAssignments = await apiFetch("/api/parent/assignments");
  assert.equal(parentAssignments.status, 200, `GET /api/parent/assignments failed: ${parentAssignments.raw}`);
  assert.ok(Array.isArray(parentAssignments.body?.data), "Parent assignments should include data array");
  assert.ok(Array.isArray(parentAssignments.body?.actionItems), "Parent assignments should include actionItems");
  assert.equal(
    typeof parentAssignments.body?.estimatedMinutes,
    "number",
    "Parent assignments should include estimatedMinutes"
  );
  assert.ok(Array.isArray(parentAssignments.body?.parentTips), "Parent assignments should include parentTips");

  const reloginStudent = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email, password, role: "student" }
  });
  assert.equal(reloginStudent.status, 200, `Student relogin failed: ${reloginStudent.raw}`);
}
