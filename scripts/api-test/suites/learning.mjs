import assert from "node:assert/strict";

export async function runLearningSuite(context) {
  const { apiFetch, state } = context;
  const { email, password } = state;
  let observerCode = state.observerCode;

  if (!observerCode) {
    const studentProfile = await apiFetch("/api/student/profile");
    assert.equal(studentProfile.status, 200, `GET /api/student/profile failed: ${studentProfile.raw}`);
    observerCode = studentProfile.body?.data?.observerCode;
    assert.equal(typeof observerCode, "string", "Student profile should expose observerCode");
    assert.ok(observerCode, "Student observerCode should not be empty");
    state.observerCode = observerCode;
  }

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
  assert.equal(practiceSubmit.body?.mastery?.total, 1, "First practice attempt should set mastery.total=1");
  assert.equal(practiceSubmit.body?.mastery?.correct, 0, "Wrong first practice attempt should set mastery.correct=0");
  assert.ok(
    ["incremental", "full_sync"].includes(String(practiceSubmit.body?.masteryUpdateMode ?? "")),
    "Practice submit should expose mastery update mode"
  );

  const practiceReviewNext = await apiFetch("/api/practice/next", {
    method: "POST",
    json: {
      subject: "math",
      grade: "4",
      knowledgePointId: practiceNext.body.question.knowledgePointId,
      mode: "review"
    }
  });
  assert.equal(practiceReviewNext.status, 200, `POST /api/practice/next review failed: ${practiceReviewNext.raw}`);
  assert.equal(
    practiceReviewNext.body?.question?.id,
    practiceNext.body.question.id,
    "Review mode should prioritize the queued wrong question for the fresh student"
  );
  assert.equal(practiceReviewNext.body?.reviewSourceType, "wrong", "Review mode should expose wrong-review source when available");
  assert.equal(typeof practiceReviewNext.body?.reviewDueAt, "string", "Review mode should expose queued review due time");

  const answerOnlyAssist = await apiFetch("/api/ai/assist", {
    method: "POST",
    json: {
      question: "12 + 8 等于多少？",
      subject: "math",
      grade: "2",
      answerMode: "answer_only"
    }
  });
  assert.equal(answerOnlyAssist.status, 200, `POST /api/ai/assist failed: ${answerOnlyAssist.raw}`);
  const answerOnlyAssistData = answerOnlyAssist.body?.data ?? answerOnlyAssist.body;
  assert.equal(typeof answerOnlyAssistData?.answer, "string", "Answer-only assist should return answer");
  assert.equal((answerOnlyAssistData?.steps ?? []).length, 0, "Answer-only assist should suppress steps");
  assert.equal((answerOnlyAssistData?.hints ?? []).length, 0, "Answer-only assist should suppress hints");

  const imageAssistForm = new FormData();
  imageAssistForm.set("question", "3/4 + 1/4 等于多少？");
  imageAssistForm.set("subject", "math");
  imageAssistForm.set("grade", "4");
  imageAssistForm.set("answerMode", "hints_first");
  imageAssistForm.append("images", new Blob([Buffer.from("api-test-image-1")], { type: "image/png" }), "question-1.png");
  imageAssistForm.append("images", new Blob([Buffer.from("api-test-image-2")], { type: "image/png" }), "question-2.png");
  const imageAssist = await apiFetch("/api/ai/solve-from-image", {
    method: "POST",
    body: imageAssistForm
  });
  assert.equal(imageAssist.status, 200, `POST /api/ai/solve-from-image failed: ${imageAssist.raw}`);
  assert.equal(
    typeof (imageAssist.body?.answer ?? imageAssist.body?.data?.answer),
    "string",
    "Image assist should return answer"
  );
  const imageAssistData = imageAssist.body?.data ?? imageAssist.body;
  assert.ok((imageAssistData?.hints ?? []).length >= 1, "Hints-first image assist should include hints");
  assert.equal(
    typeof imageAssistData?.quality?.confidenceScore,
    "number",
    "Image assist should include quality.confidenceScore"
  );
  assert.equal(typeof imageAssistData?.quality?.fallbackAction, "string", "Image assist should include fallbackAction");

  const historyCreate = await apiFetch("/api/ai/history", {
    method: "POST",
    json: {
      question: "图片识别：3/4 + 1/4 等于多少？",
      answer: "1",
      meta: {
        origin: "image",
        subject: "math",
        grade: "4",
        answerMode: "step_by_step",
        provider: "mock",
        recognizedQuestion: "3/4 + 1/4 等于多少？",
        imageCount: 2,
        quality: {
          confidenceScore: 88,
          riskLevel: "low",
          needsHumanReview: false,
          fallbackAction: "可直接使用。",
          reasons: ["API 测试样本"]
        }
      }
    }
  });
  assert.equal(historyCreate.status, 200, `POST /api/ai/history failed: ${historyCreate.raw}`);
  assert.equal(historyCreate.body?.data?.meta?.origin, "image", "History item should persist meta.origin");
  assert.equal(historyCreate.body?.data?.meta?.imageCount, 2, "History item should persist meta.imageCount");

  const patchHistory = await apiFetch(`/api/ai/history/${historyCreate.body?.data?.id}`, {
    method: "PATCH",
    json: {
      favorite: true,
      tags: ["识题", "分数"]
    }
  });
  assert.equal(patchHistory.status, 200, `PATCH /api/ai/history/:id failed: ${patchHistory.raw}`);
  assert.equal(patchHistory.body?.data?.favorite, true, "History patch should update favorite state");
  assert.deepEqual(patchHistory.body?.data?.tags ?? [], ["识题", "分数"], "History patch should update tags");

  const historyList = await apiFetch("/api/ai/history");
  assert.equal(historyList.status, 200, `GET /api/ai/history failed: ${historyList.raw}`);
  const createdHistoryItem = (historyList.body?.data ?? []).find((item) => item.id === historyCreate.body?.data?.id);
  assert.ok(createdHistoryItem, "History list should include newly created item");
  assert.equal(createdHistoryItem?.meta?.provider, "mock", "History list should preserve meta.provider");
  assert.equal(createdHistoryItem?.meta?.recognizedQuestion, "3/4 + 1/4 等于多少？");

  const tooManyImageAssist = new FormData();
  tooManyImageAssist.append("images", new Blob([Buffer.from("1")], { type: "image/png" }), "1.png");
  tooManyImageAssist.append("images", new Blob([Buffer.from("2")], { type: "image/png" }), "2.png");
  tooManyImageAssist.append("images", new Blob([Buffer.from("3")], { type: "image/png" }), "3.png");
  tooManyImageAssist.append("images", new Blob([Buffer.from("4")], { type: "image/png" }), "4.png");
  const overflowImageAssist = await apiFetch("/api/ai/solve-from-image", {
    method: "POST",
    body: tooManyImageAssist
  });
  assert.equal(overflowImageAssist.status, 400, "Image assist should reject more than 3 images");

  const studentDashboardOverview = await apiFetch("/api/dashboard/overview");
  assert.equal(studentDashboardOverview.status, 200, `GET /api/dashboard/overview failed: ${studentDashboardOverview.raw}`);
  assert.equal(studentDashboardOverview.body?.data?.role, "student", "Student dashboard overview should detect student role");
  assert.ok(Array.isArray(studentDashboardOverview.body?.data?.metrics), "Student dashboard overview should include metrics");
  assert.ok(Array.isArray(studentDashboardOverview.body?.data?.quickActions), "Student dashboard overview should include quick actions");
  const studentCalendarQuickAction = (studentDashboardOverview.body?.data?.quickActions ?? []).find((item) => item.id === "student-calendar");
  assert.ok(studentCalendarQuickAction, "Student dashboard overview should include calendar quick action");
  assert.equal(studentCalendarQuickAction?.href, "/calendar");
  const tutorQuickAction = (studentDashboardOverview.body?.data?.quickActions ?? []).find((item) => item.id === "student-tutor");
  assert.ok(tutorQuickAction, "Student dashboard overview should include tutor quick action");
  assert.equal(tutorQuickAction?.label, "拍题即问", "Tutor quick action should expose upgraded label");
  assert.ok(String(tutorQuickAction?.href ?? "").includes("intent=image"), "Tutor quick action should deep-link into image mode");

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
  assert.equal(queueItem?.originType, "practice", "Practice wrong question should keep originType=practice");

  const todayTasks = await apiFetch("/api/student/today-tasks");
  assert.equal(todayTasks.status, 200, `GET /api/student/today-tasks failed: ${todayTasks.raw}`);
  assert.equal(typeof todayTasks.body?.data?.summary?.total, "number", "Today tasks should include summary.total");
  assert.equal(typeof todayTasks.body?.data?.summary?.mustDo, "number", "Today tasks should include summary.mustDo");
  assert.ok(Array.isArray(todayTasks.body?.data?.tasks), "Today tasks should include tasks array");
  assert.ok(
    Array.isArray(todayTasks.body?.data?.groups?.mustDo),
    "Today tasks should include groups.mustDo array"
  );
  assert.equal(
    typeof todayTasks.body?.data?.summary?.bySource?.lesson,
    "number",
    "Today tasks should include lesson source count"
  );
  const firstTodayTask = todayTasks.body?.data?.tasks?.[0];
  if (firstTodayTask) {
    assert.equal(typeof firstTodayTask.id, "string");
    assert.equal(typeof firstTodayTask.source, "string");
    assert.equal(typeof firstTodayTask.href, "string");
    assert.equal(typeof firstTodayTask.priority, "number");
  }

  const studentSchedule = await apiFetch("/api/schedule");
  assert.equal(studentSchedule.status, 200, `GET /api/schedule failed: ${studentSchedule.raw}`);
  assert.equal(studentSchedule.body?.data?.role, "student", "Schedule API should detect student role");
  assert.ok(Array.isArray(studentSchedule.body?.data?.weekly), "Schedule API should include weekly lessons");
  assert.ok(Array.isArray(studentSchedule.body?.data?.todayLessons), "Schedule API should include todayLessons");
  assert.equal(
    typeof studentSchedule.body?.data?.summary?.totalLessonsToday,
    "number",
    "Schedule API should include totalLessonsToday"
  );

  const studentCalendar = await apiFetch("/api/calendar");
  assert.equal(studentCalendar.status, 200, `GET /api/calendar failed: ${studentCalendar.raw}`);
  assert.ok(Array.isArray(studentCalendar.body?.data), "Calendar API should include data array");
  const hasScheduledLessons = (studentSchedule.body?.data?.weekly ?? []).some((day) => (day.lessons ?? []).length > 0);
  if (hasScheduledLessons) {
    assert.ok(
      (studentCalendar.body?.data ?? []).some((item) => item.type === "lesson"),
      "Calendar API should include lesson timeline item when weekly schedule exists"
    );
  }

  const libraryPaged = await apiFetch("/api/library?page=1&pageSize=5");
  assert.equal(libraryPaged.status, 200, `GET /api/library paged failed: ${libraryPaged.raw}`);
  assert.ok(Array.isArray(libraryPaged.body?.data), "Library list should include data array");
  assert.equal(typeof libraryPaged.body?.meta?.total, "number", "Library list should include meta.total");
  assert.equal(typeof libraryPaged.body?.meta?.page, "number", "Library list should include meta.page");
  assert.equal(typeof libraryPaged.body?.meta?.pageSize, "number", "Library list should include meta.pageSize");
  assert.equal(
    typeof libraryPaged.body?.meta?.totalPages,
    "number",
    "Library list should include meta.totalPages"
  );
  assert.ok(Array.isArray(libraryPaged.body?.facets?.subjects), "Library list should include facets.subjects");
  assert.ok(Array.isArray(libraryPaged.body?.facets?.grades), "Library list should include facets.grades");
  assert.ok(
    Array.isArray(libraryPaged.body?.facets?.contentTypes),
    "Library list should include facets.contentTypes"
  );
  assert.equal(
    typeof libraryPaged.body?.summary?.textbookCount,
    "number",
    "Library list should include summary.textbookCount"
  );
  assert.equal(
    typeof libraryPaged.body?.summary?.coursewareCount,
    "number",
    "Library list should include summary.coursewareCount"
  );
  assert.equal(
    typeof libraryPaged.body?.summary?.lessonPlanCount,
    "number",
    "Library list should include summary.lessonPlanCount"
  );

  const uniqueKeyword = `api_test_library_kw_${Date.now().toString(36)}`;
  const libraryKeyword = await apiFetch(
    `/api/library?page=1&pageSize=5&keyword=${encodeURIComponent(uniqueKeyword)}`
  );
  assert.equal(libraryKeyword.status, 200, `GET /api/library keyword failed: ${libraryKeyword.raw}`);
  assert.ok(Array.isArray(libraryKeyword.body?.data), "Library keyword list should include data array");
  assert.equal(typeof libraryKeyword.body?.meta?.total, "number");
  assert.ok(
    (libraryKeyword.body?.data?.length ?? 0) <= 5,
    "Library keyword list should respect pageSize upper bound"
  );

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
  assert.ok(reviewResult.body?.mastery && typeof reviewResult.body.mastery === "object");
  assert.equal(reviewResult.body?.mastery?.total, 2, "Wrong review should advance mastery.total to 2 for the same question");
  assert.equal(reviewResult.body?.mastery?.correct, 1, "Wrong review correct answer should advance mastery.correct to 1");
  const reviewQueueAfterCorrect = await apiFetch("/api/wrong-book/review-queue");
  assert.equal(reviewQueueAfterCorrect.status, 200, `GET /api/wrong-book/review-queue after review submit failed: ${reviewQueueAfterCorrect.raw}`);
  const reviewQueueItemsAfterCorrect = [
    ...(reviewQueueAfterCorrect.body?.data?.today ?? []),
    ...(reviewQueueAfterCorrect.body?.data?.upcoming ?? [])
  ];
  const queueItemAfterCorrect = reviewQueueItemsAfterCorrect.find((item) => item.questionId === practiceNext.body.question.id);
  assert.ok(queueItemAfterCorrect, "Review queue should keep the reviewed question after interval upgrade");
  assert.equal(queueItemAfterCorrect?.intervalLevel, 2, "Review queue should persist the upgraded intervalLevel after correct review");
  assert.ok(
    ["incremental", "full_sync"].includes(String(reviewResult.body?.masteryUpdateMode ?? "")),
    "Wrong review should expose mastery update mode"
  );

  const weeklyReport = await apiFetch("/api/report/weekly");
  assert.equal(weeklyReport.status, 200, `GET /api/report/weekly failed: ${weeklyReport.raw}`);
  assert.ok(Array.isArray(weeklyReport.body?.actionItems), "Weekly report should include actionItems");
  assert.equal(typeof weeklyReport.body?.estimatedMinutes, "number", "Weekly report should include estimatedMinutes");
  assert.ok(Array.isArray(weeklyReport.body?.parentTips), "Weekly report should include parentTips");

  const studentAssignments = await apiFetch("/api/student/assignments");
  assert.equal(studentAssignments.status, 200, `GET /api/student/assignments failed: ${studentAssignments.raw}`);
  assert.ok(Array.isArray(studentAssignments.body?.data), "Student assignments should include data array");
  const firstStudentAssignment = studentAssignments.body?.data?.[0];
  if (firstStudentAssignment) {
    assert.equal(typeof firstStudentAssignment.className, "string", "Student assignment should include className");
    assert.equal(typeof firstStudentAssignment.classSubject, "string", "Student assignment should include classSubject");
    assert.ok(
      ["pending", "completed"].includes(firstStudentAssignment.status),
      "Student assignment should include normalized status"
    );
  }

  const parentCandidates = [
    {
      email: state.parentEmail,
      password: state.parentPassword
    },
    {
      email: process.env.API_TEST_PARENT_EMAIL || "parent@demo.com",
      password: process.env.API_TEST_PARENT_PASSWORD || "Parent123"
    },
    {
      email: process.env.API_TEST_PARENT_FALLBACK_EMAIL || "parent1@demo.com",
      password: process.env.API_TEST_PARENT_FALLBACK_PASSWORD || "Parent123"
    }
  ].filter((candidate) => candidate.email && candidate.password);

  let parentLogin = null;
  let parentAccount = null;
  for (const candidate of parentCandidates) {
    const resp = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: candidate.email, password: candidate.password, role: "parent" }
    });
    if (resp.status === 200) {
      parentLogin = resp;
      parentAccount = candidate;
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
        observerCode
      }
    });
    assert.equal(registerParent.status, 201, `Parent register failed: ${registerParent.raw}`);

    parentLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email: tempParentEmail, password: tempParentPassword, role: "parent" }
    });
    parentAccount = { email: tempParentEmail, password: tempParentPassword };
  }

  assert.equal(parentLogin?.status, 200, "Parent login failed");
  assert.ok(parentAccount?.email, "Parent account should be resolved for tutor-share regression");

  const reloginStudentForParentShare = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email, password, role: "student" }
  });
  assert.equal(
    reloginStudentForParentShare.status,
    200,
    `Student relogin for parent-share failed: ${reloginStudentForParentShare.raw}`
  );

  const tutorShareTargets = await apiFetch("/api/ai/share-targets");
  assert.equal(tutorShareTargets.status, 200, `GET /api/ai/share-targets failed: ${tutorShareTargets.raw}`);
  let parentShareTarget = (tutorShareTargets.body?.data ?? []).find((item) => item.kind === "parent");

  if (!parentShareTarget) {
    const tutorShareParentEmail = `api-test-parent-share-${Date.now().toString(36)}@local.test`;
    const tutorShareParentPassword = "ApiParentShare123!";
    const registerTutorShareParent = await apiFetch("/api/auth/register", {
      method: "POST",
      useCookies: false,
      json: {
        role: "parent",
        email: tutorShareParentEmail,
        password: tutorShareParentPassword,
        name: "API Tutor Share Parent",
        observerCode
      }
    });
    assert.equal(
      registerTutorShareParent.status,
      201,
      `Tutor-share parent register failed: ${registerTutorShareParent.raw}`
    );
    parentAccount = { email: tutorShareParentEmail, password: tutorShareParentPassword };

    const reloginStudentAfterParentBind = await apiFetch("/api/auth/login", {
      method: "POST",
      useCookies: false,
      json: { email, password, role: "student" }
    });
    assert.equal(
      reloginStudentAfterParentBind.status,
      200,
      `Student relogin after parent bind failed: ${reloginStudentAfterParentBind.raw}`
    );

    const tutorShareTargetsAfterBind = await apiFetch("/api/ai/share-targets");
    assert.equal(
      tutorShareTargetsAfterBind.status,
      200,
      `GET /api/ai/share-targets after parent bind failed: ${tutorShareTargetsAfterBind.raw}`
    );
    parentShareTarget = (tutorShareTargetsAfterBind.body?.data ?? []).find((item) => item.kind === "parent");
  }

  assert.ok(parentShareTarget, "Student tutor-share targets should include parent target");

  const tutorShareToParent = await apiFetch("/api/ai/share-result", {
    method: "POST",
    json: {
      targetId: parentShareTarget.id,
      question: "拍题分享：1/3 + 2/3 等于多少？",
      recognizedQuestion: "1/3 + 2/3 等于多少？",
      answer: "1",
      origin: "image",
      subject: "math",
      grade: "4",
      answerMode: "hints_first",
      provider: "mock",
      steps: ["同分母分数相加，只加分子。", "1 + 2 = 3，所以得到 3/3 = 1。"],
      hints: ["先看分母是否相同。"],
      quality: {
        confidenceScore: 90,
        riskLevel: "low",
        needsHumanReview: false,
        fallbackAction: "可直接与孩子对照核查。",
        reasons: ["分数同分母加法规则明确"]
      }
    }
  });
  assert.equal(tutorShareToParent.status, 200, `POST /api/ai/share-result parent failed: ${tutorShareToParent.raw}`);
  const parentTutorShareThreadId = tutorShareToParent.body?.data?.threadId;
  assert.ok(parentTutorShareThreadId, "Tutor share to parent should return threadId");

  const reloginParentForTutorShare = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email: parentAccount.email, password: parentAccount.password, role: "parent" }
  });
  assert.equal(
    reloginParentForTutorShare.status,
    200,
    `Parent relogin for tutor-share failed: ${reloginParentForTutorShare.raw}`
  );

  const parentTutorThreads = await apiFetch("/api/inbox/threads");
  assert.equal(parentTutorThreads.status, 200, `Parent GET /api/inbox/threads failed: ${parentTutorThreads.raw}`);
  const parentTutorThread = (parentTutorThreads.body?.data ?? []).find((item) => item.id === parentTutorShareThreadId);
  assert.ok(parentTutorThread, "Parent inbox should include tutor-share thread");
  assert.ok(String(parentTutorThread?.subject ?? "").includes("AI 解题分享"));

  const parentTutorThreadDetail = await apiFetch(`/api/inbox/threads/${parentTutorShareThreadId}`);
  assert.equal(
    parentTutorThreadDetail.status,
    200,
    `Parent GET /api/inbox/threads/[id] for tutor-share failed: ${parentTutorThreadDetail.raw}`
  );
  assert.ok(
    (parentTutorThreadDetail.body?.data?.messages ?? []).some(
      (item) => item.content?.includes("AI 解题结果分享") && item.content?.includes("1/3 + 2/3") && item.content?.includes("答案")
    ),
    "Parent tutor-share thread should include shared tutor result summary"
  );

  const parentDashboardOverview = await apiFetch("/api/dashboard/overview");
  assert.equal(parentDashboardOverview.status, 200, `Parent GET /api/dashboard/overview failed: ${parentDashboardOverview.raw}`);
  assert.equal(parentDashboardOverview.body?.data?.role, "parent", "Parent dashboard overview should detect parent role");
  assert.ok(Array.isArray(parentDashboardOverview.body?.data?.timeline), "Parent dashboard overview should include timeline");
  const parentCalendarQuickAction = (parentDashboardOverview.body?.data?.quickActions ?? []).find((item) => item.id === "parent-calendar");
  assert.ok(parentCalendarQuickAction, "Parent dashboard overview should include calendar quick action");
  assert.equal(parentCalendarQuickAction?.href, "/calendar");

  const parentSchedule = await apiFetch("/api/schedule");
  assert.equal(parentSchedule.status, 200, `Parent GET /api/schedule failed: ${parentSchedule.raw}`);
  assert.equal(parentSchedule.body?.data?.role, "parent", "Schedule API should detect parent role");
  assert.ok(Array.isArray(parentSchedule.body?.data?.weekly), "Parent schedule should include weekly lessons");

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
  assert.equal(
    typeof parentAssignments.body?.execution?.pendingCount,
    "number",
    "Parent assignments should include execution.pendingCount"
  );
  assert.equal(
    typeof parentAssignments.body?.execution?.streakDays,
    "number",
    "Parent assignments should include execution.streakDays"
  );
  assert.equal(
    typeof parentAssignments.body?.effect?.receiptEffectScore,
    "number",
    "Parent assignments should include effect.receiptEffectScore"
  );
  assert.equal(
    typeof parentAssignments.body?.effect?.last7dEffectScore,
    "number",
    "Parent assignments should include effect.last7dEffectScore"
  );

  const parentWeekly = await apiFetch("/api/report/weekly");
  assert.equal(parentWeekly.status, 200, `Parent GET /api/report/weekly failed: ${parentWeekly.raw}`);
  assert.ok(Array.isArray(parentWeekly.body?.actionItems), "Parent weekly report should include actionItems");
  assert.equal(
    typeof parentWeekly.body?.execution?.pendingCount,
    "number",
    "Parent weekly report should include execution.pendingCount"
  );
  assert.equal(
    typeof parentWeekly.body?.effect?.doneEffectScore,
    "number",
    "Parent weekly report should include effect.doneEffectScore"
  );
  assert.equal(
    typeof parentWeekly.body?.execution?.streakDays,
    "number",
    "Parent weekly report should include execution.streakDays"
  );
  assert.equal(
    typeof parentWeekly.body?.effect?.skippedPenaltyScore,
    "number",
    "Parent weekly report should include effect.skippedPenaltyScore"
  );
  assert.equal(
    typeof parentWeekly.body?.effect?.last7dEffectScore,
    "number",
    "Parent weekly report should include effect.last7dEffectScore"
  );

  const invalidActionItemReceipt = await apiFetch("/api/parent/action-items/receipt", {
    method: "POST",
    json: {
      source: "weekly_report",
      actionItemId: "invalid-action-item",
      status: "done",
      estimatedMinutes: 10
    }
  });
  assert.equal(
    invalidActionItemReceipt.status,
    400,
    "Receipt should reject unknown actionItemId for source"
  );

  const firstWeeklyAction = parentWeekly.body?.actionItems?.[0];
  if (firstWeeklyAction?.id) {
    const skipWithoutNote = await apiFetch("/api/parent/action-items/receipt", {
      method: "POST",
      json: {
        source: "weekly_report",
        actionItemId: firstWeeklyAction.id,
        status: "skipped",
        estimatedMinutes: firstWeeklyAction.estimatedMinutes ?? 0
      }
    });
    assert.equal(
      skipWithoutNote.status,
      400,
      "Skipping parent weekly action without note should be rejected"
    );

    const skipWithNote = await apiFetch("/api/parent/action-items/receipt", {
      method: "POST",
      json: {
        source: "weekly_report",
        actionItemId: firstWeeklyAction.id,
        status: "skipped",
        note: "本周临时冲突，改为周末完成",
        estimatedMinutes: firstWeeklyAction.estimatedMinutes ?? 0
      }
    });
    assert.equal(
      skipWithNote.status,
      200,
      `POST /api/parent/action-items/receipt weekly skipped failed: ${skipWithNote.raw}`
    );
    assert.equal(skipWithNote.body?.data?.status, "skipped");

    const parentWeeklyAfterSkip = await apiFetch("/api/report/weekly");
    assert.equal(
      parentWeeklyAfterSkip.status,
      200,
      `Parent weekly report after skip failed: ${parentWeeklyAfterSkip.raw}`
    );
    const weeklyActionAfterSkip = (parentWeeklyAfterSkip.body?.actionItems ?? []).find(
      (item) => item.id === firstWeeklyAction.id
    );
    assert.equal(weeklyActionAfterSkip?.receipt?.status, "skipped");
    assert.equal(
      typeof parentWeeklyAfterSkip.body?.execution?.skippedCount,
      "number",
      "Weekly report should include skippedCount after skip receipt"
    );
  }

  const firstAssignmentAction = parentAssignments.body?.actionItems?.[0];
  if (firstAssignmentAction?.id) {
    const assignmentDoneReceipt = await apiFetch("/api/parent/action-items/receipt", {
      method: "POST",
      json: {
        source: "assignment_plan",
        actionItemId: firstAssignmentAction.id,
        status: "done",
        estimatedMinutes: firstAssignmentAction.estimatedMinutes ?? 0
      }
    });
    assert.equal(
      assignmentDoneReceipt.status,
      200,
      `POST /api/parent/action-items/receipt assignment done failed: ${assignmentDoneReceipt.raw}`
    );
    assert.equal(assignmentDoneReceipt.body?.data?.status, "done");

    const parentAssignmentsAfterDone = await apiFetch("/api/parent/assignments");
    assert.equal(
      parentAssignmentsAfterDone.status,
      200,
      `Parent assignments after done receipt failed: ${parentAssignmentsAfterDone.raw}`
    );
    const assignmentActionAfterDone = (parentAssignmentsAfterDone.body?.actionItems ?? []).find(
      (item) => item.id === firstAssignmentAction.id
    );
    assert.equal(assignmentActionAfterDone?.receipt?.status, "done");
    assert.equal(
      typeof parentAssignmentsAfterDone.body?.execution?.completedCount,
      "number",
      "Parent assignments should include execution.completedCount after done receipt"
    );
    assert.equal(
      typeof parentAssignmentsAfterDone.body?.effect?.receiptEffectScore,
      "number",
      "Parent assignments should include effect.receiptEffectScore after done receipt"
    );
  }

  const reloginStudent = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: { email, password, role: "student" }
  });
  assert.equal(reloginStudent.status, 200, `Student relogin failed: ${reloginStudent.raw}`);
}
