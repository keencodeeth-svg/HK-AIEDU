import assert from "node:assert/strict";

function getSchoolId() {
  return process.env.API_TEST_SCHOOL_ID || process.env.API_TEST_SMOKE_SCHOOL_ID || "school-default";
}

function pickScheduleRegressionClasses(classes) {
  const teacherBoundClasses = classes.filter((item) => item.teacherId);
  for (const candidate of teacherBoundClasses) {
    const alternatives = teacherBoundClasses.filter(
      (item) => item.id !== candidate.id && item.teacherId !== candidate.teacherId
    );
    for (const alternative of alternatives) {
      const thirdClass = alternatives.find(
        (item) => item.id !== alternative.id && item.teacherId !== alternative.teacherId
      );
      if (thirdClass) {
        return [candidate, alternative, thirdClass];
      }
    }
  }
  return null;
}

async function ensureAdminSession(context) {
  const { apiFetch, cookieJar } = context;
  const adminEmail = process.env.API_TEST_ADMIN_EMAIL || "admin@demo.com";
  const adminPassword = process.env.API_TEST_ADMIN_PASSWORD || "Admin123";
  const adminLogin = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    json: {
      email: adminEmail,
      password: adminPassword,
      role: "admin"
    }
  });
  assert.equal(adminLogin.status, 200, `Admin login failed: ${adminLogin.raw}`);
  assert.ok(cookieJar.has("mvp_session"), "Admin login should set mvp_session cookie");
}

export async function runSchoolScheduleSuite(context, options = {}) {
  const { apiFetch } = context;
  const { ensureAdminLogin = true } = options;
  const schoolId = getSchoolId();

  if (ensureAdminLogin) {
    await ensureAdminSession(context);
  }

  const schoolSchedulesBefore = await apiFetch(`/api/school/schedules?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(schoolSchedulesBefore.status, 200, `GET /api/school/schedules failed: ${schoolSchedulesBefore.raw}`);
  assert.ok(Array.isArray(schoolSchedulesBefore.body?.data?.classes), "School schedules should include classes array");
  const scheduleClasses = pickScheduleRegressionClasses(schoolSchedulesBefore.body?.data?.classes ?? []);
  assert.ok(
    scheduleClasses,
    "School schedules should expose 3 teacher-bound classes across 3 different teachers for scheduling regression"
  );
  assert.ok(scheduleClasses[0]?.teacherId, "The primary regression class should be teacher-bound");
  const consecutiveRuleClass = scheduleClasses[1];
  const campusRuleClass = scheduleClasses[2];
  const initialTargetClassCount = (schoolSchedulesBefore.body?.data?.sessions ?? []).filter(
    (session) => session.classId === scheduleClasses[0].id
  ).length;

  const templateSave = await apiFetch("/api/school/schedules/templates", {
    method: "POST",
    json: {
      schoolId,
      grade: scheduleClasses[0].grade,
      subject: scheduleClasses[0].subject,
      weeklyLessonsPerClass: 3,
      lessonDurationMinutes: 40,
      periodsPerDay: 2,
      weekdays: [1, 2],
      dayStartTime: "08:00",
      shortBreakMinutes: 10,
      lunchBreakAfterPeriod: 1,
      lunchBreakMinutes: 0,
      campus: "模板校区"
    }
  });
  assert.equal(templateSave.status, 200, `POST /api/school/schedules/templates failed: ${templateSave.raw}`);
  assert.equal(templateSave.body?.data?.weeklyLessonsPerClass, 3, "Template save should persist weeklyLessonsPerClass");

  const templatesList = await apiFetch(`/api/school/schedules/templates?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(templatesList.status, 200, `GET /api/school/schedules/templates failed: ${templatesList.raw}`);
  const savedTemplate = (templatesList.body?.data ?? []).find(
    (item) => item.grade === scheduleClasses[0].grade && item.subject === scheduleClasses[0].subject
  );
  assert.ok(savedTemplate, "Saved schedule template should be listed");

  const teacherUnavailableCreate = await apiFetch("/api/school/schedules/teacher-unavailability", {
    method: "POST",
    json: {
      schoolId,
      teacherId: scheduleClasses[0].teacherId,
      weekday: 1,
      startTime: "08:00",
      endTime: "08:40",
      reason: "固定教研会"
    }
  });
  assert.equal(
    teacherUnavailableCreate.status,
    200,
    `POST /api/school/schedules/teacher-unavailability failed: ${teacherUnavailableCreate.raw}`
  );
  assert.equal(
    teacherUnavailableCreate.body?.data?.teacherId,
    scheduleClasses[0].teacherId,
    "Teacher unavailable slot should persist teacherId"
  );

  const teacherUnavailableList = await apiFetch(
    `/api/school/schedules/teacher-unavailability?schoolId=${encodeURIComponent(schoolId)}`
  );
  assert.equal(
    teacherUnavailableList.status,
    200,
    `GET /api/school/schedules/teacher-unavailability failed: ${teacherUnavailableList.raw}`
  );
  const savedUnavailable = (teacherUnavailableList.body?.data ?? []).find(
    (item) => item.id === teacherUnavailableCreate.body?.data?.id
  );
  assert.ok(savedUnavailable, "Teacher unavailable slot should be queryable");

  const lockedSeedCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: scheduleClasses[0].id,
      weekday: 4,
      startTime: "17:00",
      endTime: "17:40",
      room: "锁定教室A",
      campus: "模板校区",
      slotLabel: "锁定节次"
    }
  });
  assert.equal(lockedSeedCreate.status, 200, `POST /api/school/schedules for lock seed failed: ${lockedSeedCreate.raw}`);
  const lockedSeedId = lockedSeedCreate.body?.data?.id;
  assert.ok(lockedSeedId, "Lock seed schedule should return an id");

  const lockedSeedPatch = await apiFetch(`/api/school/schedules/${lockedSeedId}`, {
    method: "PATCH",
    json: { locked: true }
  });
  assert.equal(lockedSeedPatch.status, 200, `PATCH /api/school/schedules/:id lock failed: ${lockedSeedPatch.raw}`);
  assert.equal(lockedSeedPatch.body?.data?.locked, true, "Schedule lock should persist");

  const aiSchedulePreview = await apiFetch("/api/school/schedules/ai-preview", {
    method: "POST",
    json: {
      schoolId,
      classIds: [scheduleClasses[0].id],
      weeklyLessonsPerClass: 1,
      lessonDurationMinutes: 45,
      periodsPerDay: 5,
      weekdays: [1, 2, 3, 4, 5],
      dayStartTime: "08:00",
      shortBreakMinutes: 10,
      lunchBreakAfterPeriod: 3,
      lunchBreakMinutes: 40,
      mode: "replace_all"
    }
  });
  assert.equal(aiSchedulePreview.status, 200, `POST /api/school/schedules/ai-preview failed: ${aiSchedulePreview.raw}`);
  assert.equal(aiSchedulePreview.body?.data?.applied, false, "AI preview should not apply immediately");
  assert.ok(aiSchedulePreview.body?.data?.previewId, "AI preview should return previewId");
  assert.equal(aiSchedulePreview.body?.data?.summary?.targetClassCount, 1, "AI preview should target requested class");
  assert.equal(
    aiSchedulePreview.body?.data?.summary?.createdSessions,
    2,
    "AI preview should keep locked lessons and only generate the remaining slots"
  );
  assert.equal(
    aiSchedulePreview.body?.data?.summary?.templateAppliedClassCount,
    1,
    "AI preview should report template-applied classes"
  );
  assert.equal(
    aiSchedulePreview.body?.data?.summary?.lockedPreservedSessionCount,
    1,
    "AI preview should report preserved locked lessons"
  );
  assert.ok(Array.isArray(aiSchedulePreview.body?.data?.createdSessions), "AI preview should return createdSessions array");
  assert.ok(
    (aiSchedulePreview.body?.data?.createdSessions ?? []).every((item) => !(item.weekday === 1 && item.startTime === "08:00")),
    "AI preview should avoid teacher unavailable slots"
  );

  const schoolSchedulesAfterPreview = await apiFetch(`/api/school/schedules?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(
    schoolSchedulesAfterPreview.status,
    200,
    `GET /api/school/schedules after AI preview failed: ${schoolSchedulesAfterPreview.raw}`
  );
  const previewClassCount = (schoolSchedulesAfterPreview.body?.data?.sessions ?? []).filter(
    (session) => session.classId === scheduleClasses[0].id
  ).length;
  assert.equal(previewClassCount, initialTargetClassCount + 1, "AI preview should not persist schedule changes");

  const previewId = aiSchedulePreview.body?.data?.previewId;
  const aiScheduleApply = await apiFetch(`/api/school/schedules/ai-preview/${previewId}/apply`, {
    method: "POST"
  });
  assert.equal(aiScheduleApply.status, 200, `POST /api/school/schedules/ai-preview/:id/apply failed: ${aiScheduleApply.raw}`);
  assert.equal(aiScheduleApply.body?.data?.applied, true, "AI preview apply should persist schedules");
  assert.equal(
    aiScheduleApply.body?.data?.summary?.createdSessions,
    2,
    "Applying AI preview should create the previewed sessions only"
  );
  assert.ok(aiScheduleApply.body?.data?.rollbackAvailable, "Applied AI schedule should expose rollback availability");

  const schoolSchedulesAfterAi = await apiFetch(`/api/school/schedules?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(
    schoolSchedulesAfterAi.status,
    200,
    `GET /api/school/schedules after AI apply failed: ${schoolSchedulesAfterAi.raw}`
  );
  const firstClassCount = (schoolSchedulesAfterAi.body?.data?.sessions ?? []).filter(
    (session) => session.classId === scheduleClasses[0].id
  ).length;
  assert.equal(firstClassCount, 3, "School schedule store should keep locked seed plus AI-generated lessons for the target class");

  const latestAiOperation = await apiFetch(`/api/school/schedules/ai-operations/latest?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(
    latestAiOperation.status,
    200,
    `GET /api/school/schedules/ai-operations/latest failed: ${latestAiOperation.raw}`
  );
  assert.equal(
    latestAiOperation.body?.data?.id,
    aiScheduleApply.body?.data?.operationId,
    "Latest AI operation should match the applied preview"
  );

  const lockedDelete = await apiFetch(`/api/school/schedules/${lockedSeedId}`, {
    method: "DELETE"
  });
  assert.equal(lockedDelete.status, 409, "Locked schedules should reject direct deletion");
  assert.equal(lockedDelete.body?.error, "节次已锁定，请先解锁后再删除");

  const rollbackAi = await apiFetch("/api/school/schedules/ai-operations/rollback", {
    method: "POST",
    json: {
      schoolId,
      operationId: aiScheduleApply.body?.data?.operationId
    }
  });
  assert.equal(rollbackAi.status, 200, `POST /api/school/schedules/ai-operations/rollback failed: ${rollbackAi.raw}`);
  assert.equal(
    rollbackAi.body?.data?.restoredSessionCount,
    initialTargetClassCount + 1,
    "Rollback should restore the pre-AI snapshot for the target class"
  );

  const schoolSchedulesAfterRollback = await apiFetch(`/api/school/schedules?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(
    schoolSchedulesAfterRollback.status,
    200,
    `GET /api/school/schedules after rollback failed: ${schoolSchedulesAfterRollback.raw}`
  );
  const rolledBackClassCount = (schoolSchedulesAfterRollback.body?.data?.sessions ?? []).filter(
    (session) => session.classId === scheduleClasses[0].id
  ).length;
  assert.equal(
    rolledBackClassCount,
    initialTargetClassCount + 1,
    "Rollback should restore the target class to the pre-AI snapshot plus locked seed"
  );

  const roomOwnerCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: scheduleClasses[1].id,
      weekday: 5,
      startTime: "15:00",
      endTime: "15:40",
      room: "共享教室A",
      campus: "主校区",
      slotLabel: "测试节次"
    }
  });
  assert.equal(roomOwnerCreate.status, 200, `POST /api/school/schedules for room owner failed: ${roomOwnerCreate.raw}`);

  const roomConflictCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: scheduleClasses[2].id,
      weekday: 5,
      startTime: "15:00",
      endTime: "15:40",
      room: "共享教室A",
      campus: "主校区",
      slotLabel: "冲突节次"
    }
  });
  assert.equal(roomConflictCreate.status, 409, "Creating a schedule in the same room and time should be rejected");
  assert.equal(roomConflictCreate.body?.error, "教室时间冲突");

  const schedulesBeforeTeacherRules = await apiFetch(`/api/school/schedules?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(
    schedulesBeforeTeacherRules.status,
    200,
    `GET /api/school/schedules before teacher rules failed: ${schedulesBeforeTeacherRules.raw}`
  );
  const weeklyTeacherCurrentCount = (schedulesBeforeTeacherRules.body?.data?.sessions ?? []).filter(
    (session) => session.teacherId === scheduleClasses[0].teacherId
  ).length;
  const weeklyClassCurrentCount = (schedulesBeforeTeacherRules.body?.data?.sessions ?? []).filter(
    (session) => session.classId === scheduleClasses[0].id
  ).length;
  assert.ok(weeklyTeacherCurrentCount >= 1, "Weekly rule regression teacher should already have scheduled lessons");

  const weeklyRuleSave = await apiFetch("/api/school/schedules/teacher-rules", {
    method: "POST",
    json: {
      schoolId,
      teacherId: scheduleClasses[0].teacherId,
      weeklyMaxLessons: weeklyTeacherCurrentCount
    }
  });
  assert.equal(weeklyRuleSave.status, 200, `POST /api/school/schedules/teacher-rules failed: ${weeklyRuleSave.raw}`);
  assert.equal(
    weeklyRuleSave.body?.data?.weeklyMaxLessons,
    weeklyTeacherCurrentCount,
    "Teacher rule save should persist weeklyMaxLessons"
  );

  const teacherRuleList = await apiFetch(`/api/school/schedules/teacher-rules?schoolId=${encodeURIComponent(schoolId)}`);
  assert.equal(teacherRuleList.status, 200, `GET /api/school/schedules/teacher-rules failed: ${teacherRuleList.raw}`);
  const savedWeeklyRule = (teacherRuleList.body?.data ?? []).find((item) => item.id === weeklyRuleSave.body?.data?.id);
  assert.ok(savedWeeklyRule, "Saved teacher rule should be queryable");

  const weeklyLimitCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: scheduleClasses[0].id,
      weekday: 6,
      startTime: "18:00",
      endTime: "18:40",
      room: "周上限教室",
      campus: "主校区",
      slotLabel: "周上限测试"
    }
  });
  assert.equal(weeklyLimitCreate.status, 409, "Teacher weekly lesson cap should reject extra manual lessons");
  assert.equal(weeklyLimitCreate.body?.error, `教师周课时上限冲突：最多 ${weeklyTeacherCurrentCount} 节/周`);

  const templateRaiseForWeeklyRule = await apiFetch("/api/school/schedules/templates", {
    method: "POST",
    json: {
      schoolId,
      grade: scheduleClasses[0].grade,
      subject: scheduleClasses[0].subject,
      weeklyLessonsPerClass: weeklyClassCurrentCount + 1,
      lessonDurationMinutes: 40,
      periodsPerDay: 2,
      weekdays: [1, 2],
      dayStartTime: "08:00",
      shortBreakMinutes: 10,
      lunchBreakAfterPeriod: 1,
      lunchBreakMinutes: 0,
      campus: "模板校区"
    }
  });
  assert.equal(
    templateRaiseForWeeklyRule.status,
    200,
    `POST /api/school/schedules/templates for weekly rule failed: ${templateRaiseForWeeklyRule.raw}`
  );

  const weeklyRuleAiPreview = await apiFetch("/api/school/schedules/ai-preview", {
    method: "POST",
    json: {
      schoolId,
      classIds: [scheduleClasses[0].id],
      weeklyLessonsPerClass: weeklyClassCurrentCount + 1,
      lessonDurationMinutes: 40,
      periodsPerDay: 2,
      weekdays: [1, 2],
      dayStartTime: "08:00",
      shortBreakMinutes: 10,
      lunchBreakAfterPeriod: 1,
      lunchBreakMinutes: 0,
      mode: "fill_missing",
      campus: "模板校区"
    }
  });
  assert.equal(
    weeklyRuleAiPreview.status,
    200,
    `POST /api/school/schedules/ai-preview for teacher weekly rule failed: ${weeklyRuleAiPreview.raw}`
  );
  assert.equal(
    weeklyRuleAiPreview.body?.data?.summary?.createdSessions,
    0,
    "Teacher weekly lesson cap should block AI from adding extra lessons"
  );
  assert.equal(
    weeklyRuleAiPreview.body?.data?.impactedClasses?.[0]?.status,
    "skipped",
    "Blocked AI target class should be marked as skipped"
  );

  const consecutiveFirstCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: consecutiveRuleClass.id,
      weekday: 6,
      startTime: "21:00",
      endTime: "21:40",
      room: "连堂测试教室1",
      campus: "主校区",
      slotLabel: "连堂测试一"
    }
  });
  assert.equal(
    consecutiveFirstCreate.status,
    200,
    `POST /api/school/schedules for consecutive seed failed: ${consecutiveFirstCreate.raw}`
  );

  const consecutiveRuleSave = await apiFetch("/api/school/schedules/teacher-rules", {
    method: "POST",
    json: {
      schoolId,
      teacherId: consecutiveRuleClass.teacherId,
      maxConsecutiveLessons: 1
    }
  });
  assert.equal(
    consecutiveRuleSave.status,
    200,
    `POST /api/school/schedules/teacher-rules for consecutive rule failed: ${consecutiveRuleSave.raw}`
  );
  assert.equal(consecutiveRuleSave.body?.data?.maxConsecutiveLessons, 1, "Teacher rule save should persist maxConsecutiveLessons");

  const consecutiveBlockedCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: consecutiveRuleClass.id,
      weekday: 6,
      startTime: "21:45",
      endTime: "22:25",
      room: "连堂测试教室2",
      campus: "主校区",
      slotLabel: "连堂测试二"
    }
  });
  assert.equal(consecutiveBlockedCreate.status, 409, "Teacher consecutive lesson cap should reject adjacent lessons");
  assert.equal(consecutiveBlockedCreate.body?.error, "教师连堂上限冲突：最多连续 1 节");

  const campusFirstCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: campusRuleClass.id,
      weekday: 7,
      startTime: "21:00",
      endTime: "21:40",
      room: "跨校区测试教室1",
      campus: "南校区",
      slotLabel: "跨校区测试一"
    }
  });
  assert.equal(campusFirstCreate.status, 200, `POST /api/school/schedules for campus seed failed: ${campusFirstCreate.raw}`);

  const campusRuleSave = await apiFetch("/api/school/schedules/teacher-rules", {
    method: "POST",
    json: {
      schoolId,
      teacherId: campusRuleClass.teacherId,
      minCampusGapMinutes: 20
    }
  });
  assert.equal(
    campusRuleSave.status,
    200,
    `POST /api/school/schedules/teacher-rules for campus gap failed: ${campusRuleSave.raw}`
  );
  assert.equal(campusRuleSave.body?.data?.minCampusGapMinutes, 20, "Teacher rule save should persist minCampusGapMinutes");

  const campusBlockedCreate = await apiFetch("/api/school/schedules", {
    method: "POST",
    json: {
      classId: campusRuleClass.id,
      weekday: 7,
      startTime: "21:50",
      endTime: "22:30",
      room: "跨校区测试教室2",
      campus: "北校区",
      slotLabel: "跨校区测试二"
    }
  });
  assert.equal(campusBlockedCreate.status, 409, "Teacher cross-campus gap should reject too-tight travel windows");
  assert.equal(campusBlockedCreate.body?.error, "教师跨校区时间冲突：需至少间隔 20 分钟");
}
