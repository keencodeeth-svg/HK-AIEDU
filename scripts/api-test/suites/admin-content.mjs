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

  const suspiciousLoginFailure = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: {
      "x-forwarded-for": "203.0.113.77"
    },
    json: { email: adminEmail, password: `${adminPassword}-wrong`, role: "admin" }
  });
  assert.equal(
    suspiciousLoginFailure.status,
    401,
    `Admin suspicious login warmup should stay unauthorized: ${suspiciousLoginFailure.raw}`
  );

  const suspiciousAdminLogin = await apiFetch("/api/auth/login", {
    method: "POST",
    useCookies: false,
    headers: {
      "x-forwarded-for": "203.0.113.77"
    },
    json: { email: adminEmail, password: adminPassword, role: "admin" }
  });
  assert.equal(
    suspiciousAdminLogin.status,
    200,
    `Admin login after failed attempts should still succeed: ${suspiciousAdminLogin.raw}`
  );
  assert.ok(context.cookieJar.has("mvp_session"), "Suspicious admin login should refresh mvp_session cookie");

  const adminNotifications = await apiFetch("/api/notifications");
  assert.equal(adminNotifications.status, 200, `GET /api/notifications failed: ${adminNotifications.raw}`);
  const suspiciousLoginNotice = (adminNotifications.body?.data ?? []).find(
    (item) =>
      item.type === "security_alert" &&
      typeof item.content === "string" &&
      item.content.includes("失败尝试")
  );
  assert.ok(
    suspiciousLoginNotice,
    "Privileged suspicious login should create a security notification for the admin"
  );

  const authSecurityLogs = await apiFetch(
    `/api/admin/logs?limit=20&action=auth_security_alert&query=${encodeURIComponent(adminEmail)}`
  );
  assert.equal(authSecurityLogs.status, 200, `GET /api/admin/logs for suspicious login failed: ${authSecurityLogs.raw}`);
  const suspiciousLoginLog = (authSecurityLogs.body?.data ?? []).find(
    (item) =>
      typeof item.detail === "string" &&
      item.detail.includes(adminEmail) &&
      item.detail.includes("success_after_failures")
  );
  assert.ok(
    suspiciousLoginLog,
    "Privileged suspicious login should write an auth_security_alert admin log"
  );


  const schoolSchedulesBefore = await apiFetch("/api/school/schedules?schoolId=school-default");
  assert.equal(schoolSchedulesBefore.status, 200, `GET /api/school/schedules failed: ${schoolSchedulesBefore.raw}`);
  assert.ok(Array.isArray(schoolSchedulesBefore.body?.data?.classes), "School schedules should include classes array");
  const scheduleClasses = (schoolSchedulesBefore.body?.data?.classes ?? []).slice(0, 3);
  assert.ok(scheduleClasses.length >= 3, "School schedules should expose at least 3 classes for scheduling regression");
  assert.ok(scheduleClasses[0]?.teacherId, "The primary regression class should be teacher-bound");
  const teacherRuleClasses = (schoolSchedulesBefore.body?.data?.classes ?? []).filter(
    (item) => item.teacherId && item.id !== scheduleClasses[0].id && item.teacherId !== scheduleClasses[0].teacherId
  );
  assert.ok(teacherRuleClasses.length >= 2, "School schedules should expose at least 2 additional teacher-bound classes for teacher rule regression");
  const consecutiveRuleClass = teacherRuleClasses[0];
  const campusRuleClass = teacherRuleClasses.find((item) => item.teacherId !== consecutiveRuleClass.teacherId) ?? teacherRuleClasses[1];
  const initialTargetClassCount = (schoolSchedulesBefore.body?.data?.sessions ?? []).filter((session) => session.classId === scheduleClasses[0].id).length;

  const templateSave = await apiFetch("/api/school/schedules/templates", {
    method: "POST",
    json: {
      schoolId: "school-default",
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

  const templatesList = await apiFetch("/api/school/schedules/templates?schoolId=school-default");
  assert.equal(templatesList.status, 200, `GET /api/school/schedules/templates failed: ${templatesList.raw}`);
  const savedTemplate = (templatesList.body?.data ?? []).find(
    (item) => item.grade === scheduleClasses[0].grade && item.subject === scheduleClasses[0].subject
  );
  assert.ok(savedTemplate, "Saved schedule template should be listed");

  const teacherUnavailableCreate = await apiFetch("/api/school/schedules/teacher-unavailability", {
    method: "POST",
    json: {
      schoolId: "school-default",
      teacherId: scheduleClasses[0].teacherId,
      weekday: 1,
      startTime: "08:00",
      endTime: "08:40",
      reason: "固定教研会"
    }
  });
  assert.equal(teacherUnavailableCreate.status, 200, `POST /api/school/schedules/teacher-unavailability failed: ${teacherUnavailableCreate.raw}`);
  assert.equal(teacherUnavailableCreate.body?.data?.teacherId, scheduleClasses[0].teacherId, "Teacher unavailable slot should persist teacherId");

  const teacherUnavailableList = await apiFetch("/api/school/schedules/teacher-unavailability?schoolId=school-default");
  assert.equal(teacherUnavailableList.status, 200, `GET /api/school/schedules/teacher-unavailability failed: ${teacherUnavailableList.raw}`);
  const savedUnavailable = (teacherUnavailableList.body?.data ?? []).find((item) => item.id === teacherUnavailableCreate.body?.data?.id);
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
      schoolId: "school-default",
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
  assert.equal(aiSchedulePreview.body?.data?.summary?.createdSessions, 2, "AI preview should keep locked lessons and only generate the remaining slots");
  assert.equal(aiSchedulePreview.body?.data?.summary?.templateAppliedClassCount, 1, "AI preview should report template-applied classes");
  assert.equal(aiSchedulePreview.body?.data?.summary?.lockedPreservedSessionCount, 1, "AI preview should report preserved locked lessons");
  assert.ok(Array.isArray(aiSchedulePreview.body?.data?.createdSessions), "AI preview should return createdSessions array");
  assert.ok(
    (aiSchedulePreview.body?.data?.createdSessions ?? []).every((item) => !(item.weekday === 1 && item.startTime === "08:00")),
    "AI preview should avoid teacher unavailable slots"
  );

  const schoolSchedulesAfterPreview = await apiFetch("/api/school/schedules?schoolId=school-default");
  assert.equal(schoolSchedulesAfterPreview.status, 200, `GET /api/school/schedules after AI preview failed: ${schoolSchedulesAfterPreview.raw}`);
  const previewClassCount = (schoolSchedulesAfterPreview.body?.data?.sessions ?? []).filter((session) => session.classId === scheduleClasses[0].id).length;
  assert.equal(previewClassCount, initialTargetClassCount + 1, "AI preview should not persist schedule changes");

  const previewId = aiSchedulePreview.body?.data?.previewId;
  const aiScheduleApply = await apiFetch(`/api/school/schedules/ai-preview/${previewId}/apply`, {
    method: "POST"
  });
  assert.equal(aiScheduleApply.status, 200, `POST /api/school/schedules/ai-preview/:id/apply failed: ${aiScheduleApply.raw}`);
  assert.equal(aiScheduleApply.body?.data?.applied, true, "AI preview apply should persist schedules");
  assert.equal(aiScheduleApply.body?.data?.summary?.createdSessions, 2, "Applying AI preview should create the previewed sessions only");
  assert.ok(aiScheduleApply.body?.data?.rollbackAvailable, "Applied AI schedule should expose rollback availability");

  const schoolSchedulesAfterAi = await apiFetch("/api/school/schedules?schoolId=school-default");
  assert.equal(schoolSchedulesAfterAi.status, 200, `GET /api/school/schedules after AI apply failed: ${schoolSchedulesAfterAi.raw}`);
  const firstClassCount = (schoolSchedulesAfterAi.body?.data?.sessions ?? []).filter((session) => session.classId === scheduleClasses[0].id).length;
  assert.equal(firstClassCount, 3, "School schedule store should keep locked seed plus AI-generated lessons for the target class");

  const latestAiOperation = await apiFetch("/api/school/schedules/ai-operations/latest?schoolId=school-default");
  assert.equal(latestAiOperation.status, 200, `GET /api/school/schedules/ai-operations/latest failed: ${latestAiOperation.raw}`);
  assert.equal(latestAiOperation.body?.data?.id, aiScheduleApply.body?.data?.operationId, "Latest AI operation should match the applied preview");

  const lockedDelete = await apiFetch(`/api/school/schedules/${lockedSeedId}`, {
    method: "DELETE"
  });
  assert.equal(lockedDelete.status, 409, "Locked schedules should reject direct deletion");
  assert.equal(lockedDelete.body?.error, "节次已锁定，请先解锁后再删除");

  const rollbackAi = await apiFetch("/api/school/schedules/ai-operations/rollback", {
    method: "POST",
    json: {
      schoolId: "school-default",
      operationId: aiScheduleApply.body?.data?.operationId
    }
  });
  assert.equal(rollbackAi.status, 200, `POST /api/school/schedules/ai-operations/rollback failed: ${rollbackAi.raw}`);
  assert.equal(rollbackAi.body?.data?.restoredSessionCount, initialTargetClassCount + 1, "Rollback should restore the pre-AI snapshot for the target class");

  const schoolSchedulesAfterRollback = await apiFetch("/api/school/schedules?schoolId=school-default");
  assert.equal(schoolSchedulesAfterRollback.status, 200, `GET /api/school/schedules after rollback failed: ${schoolSchedulesAfterRollback.raw}`);
  const rolledBackClassCount = (schoolSchedulesAfterRollback.body?.data?.sessions ?? []).filter((session) => session.classId === scheduleClasses[0].id).length;
  assert.equal(rolledBackClassCount, initialTargetClassCount + 1, "Rollback should restore the target class to the pre-AI snapshot plus locked seed");

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

  const schedulesBeforeTeacherRules = await apiFetch("/api/school/schedules?schoolId=school-default");
  assert.equal(schedulesBeforeTeacherRules.status, 200, `GET /api/school/schedules before teacher rules failed: ${schedulesBeforeTeacherRules.raw}`);
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
      schoolId: "school-default",
      teacherId: scheduleClasses[0].teacherId,
      weeklyMaxLessons: weeklyTeacherCurrentCount
    }
  });
  assert.equal(weeklyRuleSave.status, 200, `POST /api/school/schedules/teacher-rules failed: ${weeklyRuleSave.raw}`);
  assert.equal(weeklyRuleSave.body?.data?.weeklyMaxLessons, weeklyTeacherCurrentCount, "Teacher rule save should persist weeklyMaxLessons");

  const teacherRuleList = await apiFetch("/api/school/schedules/teacher-rules?schoolId=school-default");
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
      schoolId: "school-default",
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
  assert.equal(templateRaiseForWeeklyRule.status, 200, `POST /api/school/schedules/templates for weekly rule failed: ${templateRaiseForWeeklyRule.raw}`);

  const weeklyRuleAiPreview = await apiFetch("/api/school/schedules/ai-preview", {
    method: "POST",
    json: {
      schoolId: "school-default",
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
  assert.equal(weeklyRuleAiPreview.status, 200, `POST /api/school/schedules/ai-preview for teacher weekly rule failed: ${weeklyRuleAiPreview.raw}`);
  assert.equal(weeklyRuleAiPreview.body?.data?.summary?.createdSessions, 0, "Teacher weekly lesson cap should block AI from adding extra lessons");
  assert.equal(weeklyRuleAiPreview.body?.data?.impactedClasses?.[0]?.status, "skipped", "Blocked AI target class should be marked as skipped");

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
  assert.equal(consecutiveFirstCreate.status, 200, `POST /api/school/schedules for consecutive seed failed: ${consecutiveFirstCreate.raw}`);

  const consecutiveRuleSave = await apiFetch("/api/school/schedules/teacher-rules", {
    method: "POST",
    json: {
      schoolId: "school-default",
      teacherId: consecutiveRuleClass.teacherId,
      maxConsecutiveLessons: 1
    }
  });
  assert.equal(consecutiveRuleSave.status, 200, `POST /api/school/schedules/teacher-rules for consecutive rule failed: ${consecutiveRuleSave.raw}`);
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
      schoolId: "school-default",
      teacherId: campusRuleClass.teacherId,
      minCampusGapMinutes: 20
    }
  });
  assert.equal(campusRuleSave.status, 200, `POST /api/school/schedules/teacher-rules for campus gap failed: ${campusRuleSave.raw}`);
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

  const adminLogs = await apiFetch("/api/admin/logs?limit=5");
  assert.equal(adminLogs.status, 200, `GET /api/admin/logs failed: ${adminLogs.raw}`);
  assert.equal(adminLogs.body?.code, 0, "Admin logs should use standard envelope");
  assert.ok(Array.isArray(adminLogs.body?.data), "Admin logs response should include data array");

  const recoverySeedEmail = `api-test-admin-recovery-${Date.now().toString(36)}@local.test`;
  const recoverySeed = await apiFetch("/api/auth/recovery-request", {
    method: "POST",
    useCookies: false,
    json: {
      role: "parent",
      email: recoverySeedEmail,
      issueType: "forgot_account",
      name: "Recovery Parent",
      studentEmail: "student-binding@local.test",
      note: "不记得注册时使用的账号"
    }
  });
  assert.equal(recoverySeed.status, 200, `POST /api/auth/recovery-request failed: ${recoverySeed.raw}`);
  const recoveryTicketId = recoverySeed.body?.data?.ticketId;
  assert.ok(recoveryTicketId, "Recovery seed should return a ticketId");

  const recoveryWorkbench = await apiFetch(`/api/admin/recovery-requests?status=pending&query=${encodeURIComponent(recoverySeedEmail)}`);
  assert.equal(recoveryWorkbench.status, 200, `GET /api/admin/recovery-requests failed: ${recoveryWorkbench.raw}`);
  assert.equal(recoveryWorkbench.body?.code, 0, "Recovery workbench should use standard envelope");
  const seededRecoveryItem = (recoveryWorkbench.body?.data?.items ?? []).find((item) => item.id === recoveryTicketId);
  assert.ok(seededRecoveryItem, "Recovery workbench should include the seeded ticket");
  assert.equal(seededRecoveryItem.status, "pending", "New recovery ticket should start as pending");
  assert.equal(seededRecoveryItem.priority, "high", "Forgot-account recovery should surface as high priority");
  assert.equal(seededRecoveryItem.slaState, "healthy", "Fresh recovery ticket should start within SLA");
  assert.equal(typeof seededRecoveryItem.nextActionLabel, "string", "Recovery workbench should expose nextActionLabel");

  const blockedKnowledgePointCreate = await apiFetch("/api/admin/knowledge-points", {
    method: "POST",
    json: {
      subject: "math",
      grade: "4",
      unit: "StepUp 单元",
      chapter: "StepUp 章节",
      title: `STEP_UP_REQUIRED_${Date.now().toString(36)}`
    }
  });
  assert.equal(
    blockedKnowledgePointCreate.status,
    428,
    `Knowledge point mutation should require step-up first: ${blockedKnowledgePointCreate.raw}`
  );
  assert.equal(blockedKnowledgePointCreate.body?.error, "admin step-up required");

  const startRecovery = await apiFetch(`/api/admin/recovery-requests/${recoveryTicketId}`, {
    method: "POST",
    json: {
      status: "in_progress",
      adminNote: "已开始人工核验注册信息"
    }
  });
  assert.equal(startRecovery.status, 428, "High-risk recovery actions should require admin step-up first");
  assert.equal(startRecovery.body?.error, "admin step-up required");

  const adminStepUp = await apiFetch("/api/admin/step-up", {
    method: "POST",
    json: {
      password: adminPassword
    }
  });
  assert.equal(adminStepUp.status, 200, `POST /api/admin/step-up failed: ${adminStepUp.raw}`);
  assert.equal(adminStepUp.body?.message, "管理员二次验证已通过");

  const startRecoveryAfterStepUp = await apiFetch(`/api/admin/recovery-requests/${recoveryTicketId}`, {
    method: "POST",
    json: {
      status: "in_progress",
      adminNote: "已开始人工核验注册信息"
    }
  });
  assert.equal(
    startRecoveryAfterStepUp.status,
    200,
    `POST /api/admin/recovery-requests/:id failed: ${startRecoveryAfterStepUp.raw}`
  );
  assert.equal(startRecoveryAfterStepUp.body?.data?.status, "in_progress", "Recovery ticket should move into in_progress");
  assert.equal(startRecoveryAfterStepUp.body?.data?.adminNote, "已开始人工核验注册信息");

  const rejectWithoutNote = await apiFetch(`/api/admin/recovery-requests/${recoveryTicketId}`, {
    method: "POST",
    json: { status: "rejected" }
  });
  assert.equal(rejectWithoutNote.status, 400, "Rejecting a recovery ticket should require explicit confirmation first");
  assert.equal(rejectWithoutNote.body?.error, "confirmAction required");

  const rejectWithoutNoteAfterConfirm = await apiFetch(`/api/admin/recovery-requests/${recoveryTicketId}`, {
    method: "POST",
    json: {
      status: "rejected",
      confirmAction: true
    }
  });
  assert.equal(rejectWithoutNoteAfterConfirm.status, 400, "Rejecting a recovery ticket should still require adminNote");
  assert.equal(rejectWithoutNoteAfterConfirm.body?.error, "adminNote required");

  const resolveRecovery = await apiFetch(`/api/admin/recovery-requests/${recoveryTicketId}`, {
    method: "POST",
    json: {
      status: "resolved",
      adminNote: "已完成账号核验并通知用户重置密码",
      confirmAction: true
    }
  });
  assert.equal(resolveRecovery.status, 200, `Resolving recovery ticket failed: ${resolveRecovery.raw}`);
  assert.equal(resolveRecovery.body?.data?.status, "resolved", "Recovery ticket should be resolved");
  assert.ok(resolveRecovery.body?.data?.handledByAdminId, "Resolved recovery ticket should record handledByAdminId");
  assert.equal(resolveRecovery.body?.data?.slaState, "closed", "Resolved recovery ticket should exit SLA tracking");

  const resolvedRecoveryList = await apiFetch(`/api/admin/recovery-requests?status=resolved&query=${encodeURIComponent(recoverySeedEmail)}`);
  assert.equal(resolvedRecoveryList.status, 200, `Resolved recovery list failed: ${resolvedRecoveryList.raw}`);
  const resolvedRecoveryItem = (resolvedRecoveryList.body?.data?.items ?? []).find((item) => item.id === recoveryTicketId);
  assert.ok(resolvedRecoveryItem, "Resolved recovery list should include the updated ticket");
  assert.equal(resolvedRecoveryItem.status, "resolved");

  const adminLogsAfterRecovery = await apiFetch("/api/admin/logs?limit=30");
  assert.equal(adminLogsAfterRecovery.status, 200, `GET /api/admin/logs after recovery failed: ${adminLogsAfterRecovery.raw}`);
  const recoveryUpdateLog = (adminLogsAfterRecovery.body?.data ?? []).find(
    (item) => item.action === "auth_recovery_update" && item.entityId === recoveryTicketId
  );
  assert.ok(recoveryUpdateLog, "Admin logs should include structured recovery update entry");
  const recoveryUpdateDetail = recoveryUpdateLog?.detail ? JSON.parse(recoveryUpdateLog.detail) : null;
  assert.equal(recoveryUpdateDetail?.summary, "关闭恢复工单并标记为已解决");
  assert.ok(Array.isArray(recoveryUpdateDetail?.changedFields), "Structured recovery update log should expose changedFields");
  assert.equal(recoveryUpdateDetail?.after?.status, "resolved", "Structured recovery update log should expose after.status");

  const filteredAdminLogs = await apiFetch(
    `/api/admin/logs?limit=10&action=auth_recovery_update&entityType=auth_recovery&query=${encodeURIComponent(recoveryTicketId)}`
  );
  assert.equal(filteredAdminLogs.status, 200, `Filtered admin logs failed: ${filteredAdminLogs.raw}`);
  const filteredLogs = filteredAdminLogs.body?.data ?? [];
  assert.ok(filteredLogs.length >= 1, "Filtered admin logs should include the recovery update entry");
  assert.ok(
    filteredLogs.every((item) => item.action === "auth_recovery_update" && item.entityType === "auth_recovery"),
    "Filtered admin logs should respect action/entityType filters"
  );
  assert.ok(
    filteredLogs.some((item) => item.entityId === recoveryTicketId),
    "Filtered admin logs should match the query term"
  );

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
  assert.equal(
    typeof observabilityMetrics.body?.data?.errorTracking?.enabled,
    "boolean",
    "Observability metrics should expose errorTracking.enabled"
  );

  const observabilityAlerts = await apiFetch("/api/admin/observability/alerts");
  assert.equal(
    observabilityAlerts.status,
    200,
    `GET /api/admin/observability/alerts failed: ${observabilityAlerts.raw}`
  );
  assert.equal(
    typeof observabilityAlerts.body?.data?.summary?.openAlerts,
    "number",
    "Observability alerts should include summary.openAlerts"
  );
  assert.ok(Array.isArray(observabilityAlerts.body?.data?.alerts), "Observability alerts should include alerts list");
  assert.ok(Array.isArray(observabilityAlerts.body?.data?.checks), "Observability alerts should include checks list");

  const aiConfig = await apiFetch("/api/admin/ai/config");
  assert.equal(aiConfig.status, 200, `GET /api/admin/ai/config failed: ${aiConfig.raw}`);
  assert.ok(
    Array.isArray(aiConfig.body?.data?.availableProviders),
    "AI config should include availableProviders array"
  );
  assert.ok(Array.isArray(aiConfig.body?.data?.providerHealth), "AI config should include providerHealth array");
  if (aiConfig.body?.data?.providerHealth?.[0]) {
    assert.equal(
      typeof aiConfig.body.data.providerHealth[0]?.chat?.configured,
      "boolean",
      "providerHealth item should include chat.configured"
    );
  }

  const aiPolicies = await apiFetch("/api/admin/ai/policies");
  assert.equal(aiPolicies.status, 200, `GET /api/admin/ai/policies failed: ${aiPolicies.raw}`);
  const assistPolicy = (aiPolicies.body?.data?.policies ?? []).find((item) => item.taskType === "assist");
  assert.ok(assistPolicy, "Assist task policy should exist");

  const aiEvals = await apiFetch(
    "/api/admin/ai/evals?datasets=explanation,writing_feedback,lesson_outline,question_check"
  );
  assert.equal(aiEvals.status, 200, `GET /api/admin/ai/evals failed: ${aiEvals.raw}`);
  assert.ok(Array.isArray(aiEvals.body?.data?.datasets), "AI evals should include datasets array");
  assert.equal(typeof aiEvals.body?.data?.summary?.passRate, "number", "AI evals should include summary.passRate");
  assert.equal(
    typeof aiEvals.body?.data?.summary?.calibrationSuggestion?.recommendedGlobalBias,
    "number",
    "AI evals should include calibrationSuggestion.recommendedGlobalBias"
  );

  const aiCalibration = await apiFetch("/api/admin/ai/quality-calibration");
  assert.equal(aiCalibration.status, 200, `GET /api/admin/ai/quality-calibration failed: ${aiCalibration.raw}`);
  assert.equal(
    typeof aiCalibration.body?.data?.globalBias,
    "number",
    "AI quality calibration should include globalBias"
  );
  assert.equal(
    typeof aiCalibration.body?.data?.rolloutPercent,
    "number",
    "AI quality calibration should include rolloutPercent"
  );
  assert.equal(
    typeof aiCalibration.body?.data?.enabled,
    "boolean",
    "AI quality calibration should include enabled switch"
  );
  assert.ok(Array.isArray(aiCalibration.body?.data?.snapshots), "AI quality calibration should include snapshots list");

  const baselineCalibration = aiCalibration.body?.data ?? null;
  const suggestion = aiEvals.body?.data?.summary?.calibrationSuggestion ?? null;
  const applyEvalCalibration = await apiFetch("/api/admin/ai/quality-calibration", {
    method: "POST",
    json: {
      globalBias: suggestion?.recommendedGlobalBias ?? 0,
      providerAdjustments: suggestion?.providerAdjustments ?? {},
      kindAdjustments: suggestion?.kindAdjustments ?? {}
    }
  });
  assert.equal(
    applyEvalCalibration.status,
    200,
    `POST /api/admin/ai/quality-calibration (apply suggestion) failed: ${applyEvalCalibration.raw}`
  );
  assert.equal(
    typeof applyEvalCalibration.body?.data?.updatedAt,
    "string",
    "Updated AI quality calibration should include updatedAt"
  );

  const calibrationAfterApply = await apiFetch("/api/admin/ai/quality-calibration");
  assert.equal(
    calibrationAfterApply.status,
    200,
    `GET /api/admin/ai/quality-calibration after apply failed: ${calibrationAfterApply.raw}`
  );
  const rollbackSnapshotId = calibrationAfterApply.body?.data?.snapshots?.[0]?.id;
  if (rollbackSnapshotId) {
    const rollbackWithoutConfirm = await apiFetch("/api/admin/ai/quality-calibration", {
      method: "POST",
      json: {
        action: "rollback",
        snapshotId: rollbackSnapshotId,
        reason: "api_test_rollback"
      }
    });
    assert.equal(
      rollbackWithoutConfirm.status,
      400,
      "AI quality calibration rollback should require explicit confirmation"
    );
    assert.equal(rollbackWithoutConfirm.body?.error, "confirmAction required");

    const rollbackCalibration = await apiFetch("/api/admin/ai/quality-calibration", {
      method: "POST",
      json: {
        action: "rollback",
        snapshotId: rollbackSnapshotId,
        reason: "api_test_rollback",
        confirmAction: true
      }
    });
    assert.equal(
      rollbackCalibration.status,
      200,
      `POST /api/admin/ai/quality-calibration (rollback) failed: ${rollbackCalibration.raw}`
    );
  }

  const restoreCalibration = await apiFetch("/api/admin/ai/quality-calibration", {
    method: "POST",
    json: {
      globalBias: baselineCalibration?.globalBias ?? 0,
      providerAdjustments: baselineCalibration?.providerAdjustments ?? {},
      kindAdjustments: baselineCalibration?.kindAdjustments ?? {},
      enabled: baselineCalibration?.enabled ?? true,
      rolloutPercent: baselineCalibration?.rolloutPercent ?? 100,
      rolloutSalt: baselineCalibration?.rolloutSalt ?? "default"
    }
  });
  assert.equal(
    restoreCalibration.status,
    200,
    `POST /api/admin/ai/quality-calibration (restore) failed: ${restoreCalibration.raw}`
  );

  const aiEvalGate = await apiFetch("/api/admin/ai/evals/gate?limit=5");
  assert.equal(aiEvalGate.status, 200, `GET /api/admin/ai/evals/gate failed: ${aiEvalGate.raw}`);
  assert.equal(typeof aiEvalGate.body?.data?.config?.enabled, "boolean", "AI eval gate should include enabled");
  assert.equal(
    typeof aiEvalGate.body?.data?.config?.minPassRate,
    "number",
    "AI eval gate should include minPassRate"
  );
  assert.ok(Array.isArray(aiEvalGate.body?.data?.recentRuns), "AI eval gate should include recentRuns");
  const baselineEvalGateConfig = aiEvalGate.body?.data?.config ?? null;

  const patchEvalGate = await apiFetch("/api/admin/ai/evals/gate", {
    method: "POST",
    json: {
      enabled: !(baselineEvalGateConfig?.enabled ?? true)
    }
  });
  assert.equal(patchEvalGate.status, 200, `POST /api/admin/ai/evals/gate (patch) failed: ${patchEvalGate.raw}`);
  assert.equal(
    patchEvalGate.body?.data?.config?.enabled,
    !(baselineEvalGateConfig?.enabled ?? true),
    "AI eval gate patch should update enabled"
  );

  const runEvalGate = await apiFetch("/api/admin/ai/evals/gate", {
    method: "POST",
    json: {
      action: "run",
      force: true,
      configOverride: {
        autoRollbackOnFail: false
      }
    }
  });
  assert.equal(runEvalGate.status, 200, `POST /api/admin/ai/evals/gate (run) failed: ${runEvalGate.raw}`);
  assert.ok(runEvalGate.body?.data?.lastRun?.id, "AI eval gate run should return lastRun.id");
  assert.equal(
    typeof runEvalGate.body?.data?.report?.summary?.passRate,
    "number",
    "AI eval gate run should return report.summary.passRate"
  );

  const restoreEvalGate = await apiFetch("/api/admin/ai/evals/gate", {
    method: "POST",
    json: {
      enabled: baselineEvalGateConfig?.enabled ?? true,
      datasets: baselineEvalGateConfig?.datasets ?? [
        "explanation",
        "homework_review",
        "knowledge_points_generate",
        "writing_feedback",
        "lesson_outline",
        "question_check"
      ],
      minPassRate: baselineEvalGateConfig?.minPassRate ?? 75,
      minAverageScore: baselineEvalGateConfig?.minAverageScore ?? 68,
      maxHighRiskCount: baselineEvalGateConfig?.maxHighRiskCount ?? 6,
      autoRollbackOnFail: baselineEvalGateConfig?.autoRollbackOnFail ?? false
    }
  });
  assert.equal(
    restoreEvalGate.status,
    200,
    `POST /api/admin/ai/evals/gate (restore) failed: ${restoreEvalGate.raw}`
  );

  const tightenAssistBudget = await apiFetch("/api/admin/ai/policies", {
    method: "POST",
    json: {
      taskType: "assist",
      providerChain: assistPolicy.providerChain,
      timeoutMs: assistPolicy.timeoutMs,
      maxRetries: assistPolicy.maxRetries,
      budgetLimit: 100,
      minQualityScore: assistPolicy.minQualityScore
    }
  });
  assert.equal(
    tightenAssistBudget.status,
    200,
    `POST /api/admin/ai/policies (tighten assist budget) failed: ${tightenAssistBudget.raw}`
  );

  const budgetHitQuestion = `API_TEST_BUDGET_HIT_${Date.now().toString(36)}_${"超预算测试".repeat(60)}`;
  const assistBudgetHit = await apiFetch("/api/ai/assist", {
    method: "POST",
    json: {
      question: budgetHitQuestion,
      subject: "math",
      grade: "4"
    }
  });
  assert.equal(assistBudgetHit.status, 200, `POST /api/ai/assist failed: ${assistBudgetHit.raw}`);

  const aiMetricsAfterBudgetHit = await apiFetch("/api/admin/ai/metrics?limit=20");
  assert.equal(
    aiMetricsAfterBudgetHit.status,
    200,
    `GET /api/admin/ai/metrics after budget hit failed: ${aiMetricsAfterBudgetHit.raw}`
  );
  const budgetHitFailure = (aiMetricsAfterBudgetHit.body?.data?.recentFailures ?? []).find(
    (item) => item.taskType === "assist" && item.policyHit === "budget_limit"
  );
  assert.ok(
    budgetHitFailure,
    "AI metrics recentFailures should include policyHit=budget_limit after assist budget test"
  );

  const restoreAssistPolicy = await apiFetch("/api/admin/ai/policies", {
    method: "POST",
    json: {
      taskType: "assist",
      providerChain: assistPolicy.providerChain,
      timeoutMs: assistPolicy.timeoutMs,
      maxRetries: assistPolicy.maxRetries,
      budgetLimit: assistPolicy.budgetLimit,
      minQualityScore: assistPolicy.minQualityScore
    }
  });
  assert.equal(
    restoreAssistPolicy.status,
    200,
    `POST /api/admin/ai/policies (restore assist policy) failed: ${restoreAssistPolicy.raw}`
  );

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
  assert.equal(
    typeof questionList.body?.qualitySummary?.trackedCount,
    "number",
    "Question list should include qualitySummary.trackedCount"
  );
  assert.ok(
    Array.isArray(questionList.body?.qualitySummary?.topDuplicateClusters),
    "Question list should include qualitySummary.topDuplicateClusters"
  );
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

  const qualityRecheck = await apiFetch("/api/admin/questions/quality/recheck", {
    method: "POST",
    json: {
      subject: "math",
      grade: "4",
      limit: 100
    }
  });
  assert.equal(
    qualityRecheck.status,
    200,
    `POST /api/admin/questions/quality/recheck failed: ${qualityRecheck.raw}`
  );
  assert.equal(
    typeof qualityRecheck.body?.data?.scope?.processedCount,
    "number",
    "Quality recheck should include scope.processedCount"
  );
  assert.equal(
    typeof qualityRecheck.body?.data?.summary?.updated,
    "number",
    "Quality recheck should include summary.updated"
  );
  assert.ok(
    Array.isArray(qualityRecheck.body?.data?.summary?.topDuplicateClusters),
    "Quality recheck should include summary.topDuplicateClusters"
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
